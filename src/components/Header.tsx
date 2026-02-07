"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import Container from "@/components/Container";
import MobileMenu from "@/components/MobileMenu";
import { useCart } from "@/components/cart/CartProvider";
import { formatEUR } from "@/lib/format";

function MenuIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 21a8 8 0 10-16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 13a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function CartIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6h15l-2 9H7L6 6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M6 6L5 3H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 20a1 1 0 100-2 1 1 0 000 2zM18 20a1 1 0 100-2 1 1 0 000 2z" fill="currentColor" />
    </svg>
  );
}

/* ---------------------------
   Categorie (fail-safe)
---------------------------- */
type NavSub = { slug: string; label: string };
export type NavCat = { slug: string; label: string; icon?: string | null; subcategories: NavSub[] };

// fallback (menu sempre usabile)
const FALLBACK_CATEGORIES: NavCat[] = [
  { slug: "prodotti-per-pasticceria", label: "Prodotti per pasticceria", icon: null, subcategories: [] },
  { slug: "decorazioni-per-dolci", label: "Decorazioni per dolci", icon: null, subcategories: [] },
  { slug: "confetti", label: "Confetti", icon: null, subcategories: [] },
];

// ⚠️ usato SOLO per trasformare /uploads/... in URL assoluto per <img>.
const PUBLIC_STRAPI_URL = String(process.env.NEXT_PUBLIC_STRAPI_URL || "").replace(/\/+$/, "");

const FETCH_TIMEOUT_MS = 6500;
const STORAGE_KEY = "tf_nav_categories_v1";
const STORAGE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

function safeString(v: unknown, fallback = "") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeAssetUrl(raw: unknown): string | null {
  const s = safeString(raw, "");
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("data:") || s.startsWith("blob:")) return s;
  if (s.startsWith("/uploads/") && PUBLIC_STRAPI_URL) return `${PUBLIC_STRAPI_URL}${s}`;
  return s;
}

function isNavSub(x: any): x is NavSub {
  return x && typeof x === "object" && typeof x.slug === "string" && typeof x.label === "string";
}

function isNavCat(x: any): x is NavCat {
  return x && typeof x === "object" && typeof x.slug === "string" && typeof x.label === "string" && Array.isArray(x.subcategories);
}

function normalizeStrapiCategory(row: any): NavCat | null {
  const a = row?.attributes ?? row ?? {};
  const slug = safeString(a?.slug, "");
  if (!slug) return null;

  const label = safeString(a?.label ?? a?.name ?? a?.title, slug);

  const iconRaw =
    a?.icon?.data?.attributes?.url ??
    a?.icon?.attributes?.url ??
    a?.icon?.url ??
    a?.iconUrl ??
    a?.icon ??
    null;

  const icon = normalizeAssetUrl(iconRaw);

  const subsData = a?.subcategories?.data ?? a?.subcategories ?? [];
  const subcategories: NavSub[] = Array.isArray(subsData)
    ? subsData
        .map((s: any) => {
          const sa = s?.attributes ?? s ?? {};
          const sSlug = safeString(sa?.slug, "");
          if (!sSlug) return null;
          const sLabel = safeString(sa?.label ?? sa?.name ?? sa?.title, sSlug);
          return { slug: sSlug, label: sLabel };
        })
        .filter(isNavSub)
    : [];

  return { slug, label, icon, subcategories };
}

function loadFromStorage(): NavCat[] | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const json = safeJsonParse(raw);
    const ts = Number(json?.ts ?? 0);
    const data = json?.data;

    if (!Number.isFinite(ts) || Date.now() - ts > STORAGE_TTL_MS) return null;
    if (!Array.isArray(data)) return null;

    const normalized = data.map(normalizeStrapiCategory).filter(isNavCat);
    return normalized.length ? normalized : null;
  } catch {
    return null;
  }
}

function saveToStorage(cats: NavCat[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ts: Date.now(), data: cats }));
  } catch {
    // noop
  }
}

async function fetchWithTimeout(url: string, ms: number, signal?: AbortSignal) {
  const controller = new AbortController();
  const t = window.setTimeout(() => controller.abort(), ms);

  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener("abort", onAbort, { once: true });

  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    return res;
  } finally {
    window.clearTimeout(t);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}

async function fetchHeaderCategories(signal?: AbortSignal): Promise<NavCat[]> {
  try {
    const res = await fetchWithTimeout("/api/nav/categories", FETCH_TIMEOUT_MS, signal);
    const text = await res.text().catch(() => "");
    const json = safeJsonParse(text);

    const rawList: any[] = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
    const normalized = rawList.map(normalizeStrapiCategory).filter(isNavCat);
    return normalized.length ? normalized : [];
  } catch {
    return [];
  }
}

/* ---------------------------
   Header
---------------------------- */
export default function Header() {
  const { summary } = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [cat, setCat] = useState(searchParams.get("categoria") ?? "");
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [categories, setCategories] = useState<NavCat[]>([]);
  const [catsLoaded, setCatsLoaded] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const cartCount = mounted ? summary.count : 0;
  const cartTotal = mounted ? summary.total : 0;

  // sync state con URL
  useEffect(() => {
    const nextCat = searchParams.get("categoria") ?? "";
    const nextQ = searchParams.get("q") ?? "";
    if (nextCat !== cat) setCat(nextCat);
    if (nextQ !== q) setQ(nextQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // prefill immediato da storage
  useEffect(() => {
    if (!mounted) return;
    const cached = loadFromStorage();
    if (cached?.length) setCategories(cached);
  }, [mounted]);

  // fetch categorie (solo API interna)
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    (async () => {
      try {
        const cats = await fetchHeaderCategories(controller.signal);
        if (!alive) return;

        if (cats.length) {
          setCategories(cats);
          saveToStorage(cats);
        } else {
          setCategories((prev) => (prev.length ? prev : []));
        }
      } finally {
        if (!alive) return;
        setCatsLoaded(true);
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  const safeCategories = useMemo(() => (Array.isArray(categories) ? categories : []), [categories]);

  const displayedCategories = useMemo(() => {
    if (safeCategories.length > 0) return safeCategories;
    if (catsLoaded) return FALLBACK_CATEGORIES;
    return [];
  }, [safeCategories, catsLoaded]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();

    const nextQ = q.trim();
    const nextCat = cat.trim();

    // ✅ se vuoto: non fare nulla (niente reload inutile)
    if (!nextCat && !nextQ) return;

    const sp = new URLSearchParams();
    const sort = searchParams.get("sort");
    if (sort) sp.set("sort", sort);

    if (nextCat) sp.set("categoria", nextCat);
    if (nextQ) sp.set("q", nextQ);

    const qs = sp.toString();
    const target = qs ? `/catalogo?${qs}` : `/catalogo`;

    // ✅ evita push inutile se sei già sulla stessa URL
    const current = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    if (current === target) return;

    router.push(target);
  }

  // Open/close menu da eventi globali (bottom nav, ecc.)
  useEffect(() => {
    function onOpen() {
      setMobileMenuOpen(true);
    }
    function onClose() {
      setMobileMenuOpen(false);
    }

    window.addEventListener("mobile-menu:open", onOpen as EventListener);
    window.addEventListener("mobile-menu:close", onClose as EventListener);

    return () => {
      window.removeEventListener("mobile-menu:open", onOpen as EventListener);
      window.removeEventListener("mobile-menu:close", onClose as EventListener);
    };
  }, []);

  const searchPlaceholder = "Cerca vaniglia, confetti, stampi…";

  return (
    <header className="border-b border-border bg-background/90 backdrop-blur">
      <Container>
        {/* MOBILE: MENU sx + LOGO centrato + CARRELLO dx */}
        <div className="md:hidden grid grid-cols-3 items-center py-2">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="justify-self-start inline-flex h-10 w-12 flex-col items-center justify-center gap-0.5 rounded-xl hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Apri menu categorie"
            aria-haspopup="dialog"
            aria-expanded={mobileMenuOpen}
          >
            <MenuIcon />
            <span className="text-[10px] font-extrabold tracking-wide text-muted-text">MENU</span>
          </button>

          <Link
            href="/"
            className="justify-self-center flex items-center rounded-xl px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Home"
          >
            <Image
              src="/brand/tavoleefavole-logo.svg"
              alt="Tavole & Favole"
              width={170}
              height={48}
              priority
              className="h-10 w-auto"
            />
          </Link>

          <Link
            href="/carrello"
            className="justify-self-end inline-flex h-10 w-12 flex-col items-center justify-center gap-0.5 rounded-xl hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Carrello"
          >
            <div className="relative">
              <CartIcon />
              {cartCount > 0 ? (
                <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-contrast">
                  {cartCount}
                </span>
              ) : null}
            </div>
            <span className="text-[10px] font-extrabold tracking-wide text-muted-text">CARRELLO</span>
          </Link>
        </div>

        {/* DESKTOP */}
        <div className="hidden md:flex items-center gap-3 py-3">
          <Link
            href="/"
            className="flex items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Home"
          >
            <Image
              src="/brand/tavoleefavole-logo.svg"
              alt="Tavole & Favole"
              width={290}
              height={92}
              priority
              className="h-16 w-auto"
            />
          </Link>

          <form onSubmit={onSubmit} className="flex flex-1 items-center overflow-hidden rounded-full border border-border bg-white h-11">
            <div className="flex items-center border-r border-border h-11">
              <select
                value={cat}
                onChange={(e) => setCat(e.target.value)}
                aria-label="Categoria"
                className="h-11 bg-transparent px-3 text-sm outline-none cursor-pointer"
              >
                <option value="">Tutte</option>
                {!catsLoaded ? <option disabled>Caricamento…</option> : null}
                {displayedCategories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <input
              type="search"
              enterKeyHint="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-11 flex-1 px-3 text-sm outline-none"
              aria-label="Cerca prodotti"
            />

            <button
              type="submit"
              className="h-11 px-5 text-sm font-extrabold bg-primary text-primary-contrast hover:bg-primary-hover transition"
            >
              Cerca
            </button>
          </form>

          <div className="flex items-center gap-2">
            <Link
              href="/account"
              className="inline-flex h-10 items-center gap-2 rounded-xl px-3 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Account"
            >
              <UserIcon />
              <span className="hidden lg:inline text-sm text-text">Account</span>
            </Link>

            <Link
              href="/carrello"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-surface px-3 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Carrello"
            >
              <div className="relative">
                <CartIcon />
                {cartCount > 0 ? (
                  <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-contrast">
                    {cartCount}
                  </span>
                ) : null}
              </div>

              <div className="hidden lg:flex lg:flex-col lg:leading-tight">
                <span className="text-xs text-muted-text">Totale</span>
                <span className="text-sm font-semibold text-text">{formatEUR(cartTotal)}</span>
              </div>
            </Link>
          </div>
        </div>

        {/* MOBILE search */}
        <form onSubmit={onSubmit} className="md:hidden pb-3 flex h-11 items-center overflow-hidden rounded-full border border-border bg-white">
          <div className="flex items-center border-r border-border h-11">
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              aria-label="Categoria"
              className="h-11 bg-transparent px-3 text-sm outline-none cursor-pointer"
            >
              <option value="">Tutte</option>
              {!catsLoaded ? <option disabled>Caricamento…</option> : null}
              {displayedCategories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <input
            type="search"
            enterKeyHint="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-11 flex-1 px-3 text-sm outline-none"
            aria-label="Cerca prodotti"
          />

          <button
            type="submit"
            className="h-11 px-5 text-sm font-extrabold bg-primary text-primary-contrast hover:bg-primary-hover transition"
          >
            Cerca
          </button>
        </form>
      </Container>

      {/* ✅ UNICA implementazione menu mobile */}
      <MobileMenu
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        categories={displayedCategories}
        catsLoaded={catsLoaded}
        cartCount={cartCount}
      />
    </header>
  );
}
