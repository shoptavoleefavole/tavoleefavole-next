//src/components/header

"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import Container from "@/components/Container";
import MobileMenu from "@/components/MobileMenu";
import { useCart } from "@/components/cart/CartProvider";
import { formatEUR } from "@/lib/format";

const AUTH_EVENT = "tf:auth-changed";
const STORAGE_KEY = "tf_nav_categories_v1";
const STORAGE_TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 6500;

const PUBLIC_STRAPI_URL = String(process.env.NEXT_PUBLIC_STRAPI_URL || "").replace(/\/+$/, "");

/* ─── Icons ──────────────────────────────────────────────────────────── */
function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <line x1="3" y1="6"  x2="21" y2="6"  />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

/* ─── Types ───────────────────────────────────────────────────────────── */
type NavSub = { slug: string; label: string };
export type NavCat = { slug: string; label: string; icon?: string | null; subcategories: NavSub[] };

type AccountType = "PERSON" | "BUSINESS";
type ProfileSummary = { loggedIn: boolean; type: AccountType | null; displayName: string };

const FALLBACK_CATEGORIES: NavCat[] = [
  { slug: "prodotti-per-pasticceria", label: "Prodotti per pasticceria", icon: null, subcategories: [] },
  { slug: "decorazioni-per-dolci",    label: "Decorazioni per dolci",    icon: null, subcategories: [] },
  { slug: "confetti",                 label: "Confetti",                 icon: null, subcategories: [] },
];

/* ─── Utils ───────────────────────────────────────────────────────────── */
function safeString(v: unknown, fallback = "") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function safeJsonParse(text: string): any {
  try { return text ? JSON.parse(text) : null; } catch { return null; }
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
          return { slug: sSlug, label: safeString(sa?.label ?? sa?.name ?? sa?.title, sSlug) };
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
    if (!Number.isFinite(ts) || Date.now() - ts > STORAGE_TTL_MS) return null;
    if (!Array.isArray(json?.data)) return null;
    const normalized = json.data.map(normalizeStrapiCategory).filter(isNavCat);
    return normalized.length ? normalized : null;
  } catch { return null; }
}

function saveToStorage(cats: NavCat[]) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ts: Date.now(), data: cats })); }
  catch { /* noop */ }
}

async function fetchWithTimeout(url: string, ms: number, signal?: AbortSignal) {
  const controller = new AbortController();
  const t = window.setTimeout(() => controller.abort(), ms);
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener("abort", onAbort, { once: true });
  try {
    return await fetch(url, { cache: "no-store", signal: controller.signal, credentials: "include" });
  } finally {
    window.clearTimeout(t);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}

async function fetchHeaderCategories(signal?: AbortSignal): Promise<NavCat[]> {
  try {
    const res = await fetchWithTimeout("/api/nav/categories", FETCH_TIMEOUT_MS, signal);
    const json = safeJsonParse(await res.text().catch(() => ""));
    const rawList: any[] = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
    const normalized = rawList.map(normalizeStrapiCategory).filter(isNavCat);
    return normalized.length ? normalized : [];
  } catch { return []; }
}

function sanitizeInlineText(input: unknown, maxLen = 60): string {
  const raw = String(input ?? "");
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen)}…` : cleaned;
}

async function fetchProfileSummary(signal?: AbortSignal): Promise<ProfileSummary> {
  try {
    const res = await fetch("/api/auth/me", {
      method: "GET", cache: "no-store", credentials: "include",
      headers: { Accept: "application/json" }, signal,
    });
    const json = safeJsonParse(await res.text().catch(() => ""));
    if (!Boolean(json?.loggedIn)) return { loggedIn: false, type: null, displayName: "" };
    const accountTypeRaw = String(json?.user?.accountType ?? "").toUpperCase();
    const type = (accountTypeRaw === "BUSINESS" ? "BUSINESS" : "PERSON") as AccountType;
    return { loggedIn: true, type, displayName: sanitizeInlineText(json?.user?.displayName, 60) || "Account" };
  } catch { return { loggedIn: false, type: null, displayName: "" }; }
}

function accountLinkForGuest() {
  return `/accedi?next=${encodeURIComponent("/account")}`;
}

/* ─── SearchForm — componente riutilizzabile ──────────────────────────── */
function SearchForm({
  cat, setCat, q, setQ, onSubmit, catsLoaded, displayedCategories, isMobile = false,
}: {
  cat: string;
  setCat: (v: string) => void;
  q: string;
  setQ: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  catsLoaded: boolean;
  displayedCategories: NavCat[];
  isMobile?: boolean;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className={[
        "flex items-stretch overflow-hidden rounded-2xl border border-line/10 bg-surface-1 shadow-sm",
        // Mobile: altezza leggermente più piccola, grid preciso 1/4+2/4+1/4
        isMobile
          ? "h-11 grid grid-cols-4 w-full"
          : "h-11 flex-1",
      ].join(" ")}
      role="search"
    >
      {/* Categoria — 1/4 su mobile, auto su desktop */}
      <div
        className={[
          "flex items-center border-r border-line/10 shrink-0",
          isMobile ? "col-span-1" : "",
        ].join(" ")}
      >
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          aria-label="Filtra per categoria"
          className={[
            "h-full bg-transparent font-semibold text-text outline-none cursor-pointer appearance-none",
            isMobile
              ? "w-full pl-2 pr-1 text-[11px] text-center"
              : "pl-4 pr-3 text-sm min-w-[140px]",
          ].join(" ")}
        >
          <option value="">Tutte</option>
          {!catsLoaded ? <option disabled>…</option> : null}
          {displayedCategories.map((c) => (
            <option key={c.slug} value={c.slug}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Input — 2/4 su mobile, flex-1 su desktop */}
      <input
        type="search"
        enterKeyHint="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={isMobile ? "Cerca…" : "Cerca vaniglia, confetti, stampi…"}
        className={[
          "h-full bg-transparent text-sm outline-none placeholder:text-muted-text",
          isMobile ? "col-span-2 px-2 w-full min-w-0" : "flex-1 px-4",
        ].join(" ")}
        aria-label="Cerca prodotti"
      />

      {/* Bottone Cerca — 1/4 su mobile, auto su desktop */}
      <button
        type="submit"
        aria-label="Cerca"
        className={[
          "h-full font-extrabold bg-primary text-primary-contrast hover:bg-primary-hover transition shrink-0",
          isMobile
            ? "col-span-1 flex items-center justify-center gap-1 text-[11px] px-1 rounded-r-2xl"
            : "px-6 text-sm rounded-r-2xl",
        ].join(" ")}
      >
        {isMobile ? (
          <>
            <SearchIcon />
            <span className="hidden xs:inline">Cerca</span>
          </>
        ) : (
          "Cerca"
        )}
      </button>
    </form>
  );
}

/* ─── Header ─────────────────────────────────────────────────────────── */
export default function Header() {
  const { summary } = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [cat, setCat] = useState(searchParams.get("categoria") ?? "");
  const [q, setQ]     = useState(searchParams.get("q") ?? "");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [categories, setCategories]         = useState<NavCat[]>([]);
  const [catsLoaded, setCatsLoaded]         = useState(false);
  const [mounted, setMounted]               = useState(false);

  useEffect(() => setMounted(true), []);

  const cartCount = mounted ? summary.count : 0;
  const cartTotal = mounted ? summary.total : 0;

  const [meLoaded, setMeLoaded]       = useState(false);
  const [loggedIn, setLoggedIn]       = useState(false);
  const [displayName, setDisplayName] = useState<string>("");
  const accountRef = useRef<HTMLDivElement | null>(null);

  const currentPathWithQuery = useMemo(() => {
    const qs = searchParams.toString();
    return `${pathname}${qs ? `?${qs}` : ""}`;
  }, [pathname, searchParams]);

  // Sync URL → stato
  useEffect(() => {
    const nextCat = searchParams.get("categoria") ?? "";
    const nextQ   = searchParams.get("q") ?? "";
    if (nextCat !== cat) setCat(nextCat);
    if (nextQ   !== q)   setQ(nextQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Cache categorie
  useEffect(() => {
    if (!mounted) return;
    const cached = loadFromStorage();
    if (cached?.length) setCategories(cached);
  }, [mounted]);

  // Fetch categorie
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    (async () => {
      try {
        const cats = await fetchHeaderCategories(controller.signal);
        if (!alive) return;
        if (cats.length) { setCategories(cats); saveToStorage(cats); }
      } finally {
        if (alive) setCatsLoaded(true);
      }
    })();
    return () => { alive = false; controller.abort(); };
  }, []);

  // Auth
  const refreshAuth = async (signal?: AbortSignal) => {
    const r = await fetchProfileSummary(signal);
    setLoggedIn(r.loggedIn);
    setDisplayName(r.displayName);
    setMeLoaded(true);
  };

  useEffect(() => {
    const c = new AbortController();
    refreshAuth(c.signal).catch(() => { setLoggedIn(false); setDisplayName(""); setMeLoaded(true); });
    return () => c.abort();
  }, []);

  useEffect(() => {
    function onAuthChanged() {
      const c = new AbortController();
      refreshAuth(c.signal).catch(() => { setLoggedIn(false); setDisplayName(""); setMeLoaded(true); });
    }
    window.addEventListener(AUTH_EVENT, onAuthChanged as EventListener);
    return () => window.removeEventListener(AUTH_EVENT, onAuthChanged as EventListener);
  }, []);

  // Mobile menu events
  useEffect(() => {
    const onOpen  = () => setMobileMenuOpen(true);
    const onClose = () => setMobileMenuOpen(false);
    window.addEventListener("mobile-menu:open",  onOpen  as EventListener);
    window.addEventListener("mobile-menu:close", onClose as EventListener);
    return () => {
      window.removeEventListener("mobile-menu:open",  onOpen  as EventListener);
      window.removeEventListener("mobile-menu:close", onClose as EventListener);
    };
  }, []);

  const displayedCategories = useMemo(() => {
    if (Array.isArray(categories) && categories.length > 0) return categories;
    if (catsLoaded) return FALLBACK_CATEGORIES;
    return [];
  }, [categories, catsLoaded]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const nextQ   = q.trim();
    const nextCat = cat.trim();
    if (!nextCat && !nextQ) return;

    const sp   = new URLSearchParams();
    const sort = searchParams.get("sort");
    if (sort)    sp.set("sort",      sort);
    if (nextCat) sp.set("categoria", nextCat);
    if (nextQ)   sp.set("q",        nextQ);

    const qs     = sp.toString();
    const target = qs ? `/catalogo?${qs}` : `/catalogo`;
    if (currentPathWithQuery === target) return;
    router.push(target);
  }

  const accountHref = loggedIn ? "/account" : accountLinkForGuest();

  return (
    <header className="sticky top-0 z-40 border-b border-line/10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70 shadow-header">
      <Container>

        {/* ── MOBILE TOP BAR ── */}
        <div className="md:hidden grid grid-cols-3 items-center py-2 gap-1">
          {/* Hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="justify-self-start inline-flex h-10 w-11 flex-col items-center justify-center gap-0.5 rounded-xl hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Apri menu categorie"
            aria-haspopup="dialog"
            aria-expanded={mobileMenuOpen}
          >
            <MenuIcon />
            <span className="text-[9px] font-extrabold tracking-wide text-muted-text">MENU</span>
          </button>

          {/* Logo centrato */}
          <Link
            href="/"
            className="justify-self-center flex items-center rounded-xl px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Home — Tavole e Favole"
          >
            <Image
              src="/brand/tavoleefavole-logo.svg"
              alt="Tavole & Favole"
              width={180}
              height={52}
              priority
              className="h-11 w-auto"
            />
          </Link>

          {/* Carrello */}
          <Link
            href="/carrello"
            className="justify-self-end inline-flex h-10 w-11 flex-col items-center justify-center gap-0.5 rounded-xl hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary relative"
            aria-label={`Carrello${cartCount > 0 ? `, ${cartCount} articoli` : ""}`}
          >
            <div className="relative">
              <CartIcon />
              {cartCount > 0 && (
                <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-contrast">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </div>
            <span className="text-[9px] font-extrabold tracking-wide text-muted-text">CARRELLO</span>
          </Link>
        </div>

        {/* ── MOBILE SEARCH BAR (1/4 + 2/4 + 1/4) ── */}
        <div className="md:hidden pb-2.5">
          <SearchForm
            cat={cat} setCat={setCat}
            q={q} setQ={setQ}
            onSubmit={onSubmit}
            catsLoaded={catsLoaded}
            displayedCategories={displayedCategories}
            isMobile={true}
          />
        </div>

        {/* ── DESKTOP ── */}
        <div className="hidden md:flex items-center gap-4 py-3">
          {/* Logo */}
          <Link
            href="/"
            className="flex shrink-0 items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Home — Tavole e Favole"
          >
            <Image
              src="/brand/tavoleefavole-logo.svg"
              alt="Tavole & Favole"
              width={340}
              height={108}
              priority
              className="h-20 w-auto"
            />
          </Link>

          {/* Search desktop */}
          <SearchForm
            cat={cat} setCat={setCat}
            q={q} setQ={setQ}
            onSubmit={onSubmit}
            catsLoaded={catsLoaded}
            displayedCategories={displayedCategories}
            isMobile={false}
          />

          {/* Account + Cart */}
          <div className="flex shrink-0 items-center gap-2">
            <div className="relative" ref={accountRef}>
              <Link
                href={accountHref}
                className="inline-flex h-10 items-center gap-2 rounded-xl px-3 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Account utente"
              >
                <UserIcon />
                <span className="hidden lg:inline text-sm text-text">
                  {!meLoaded ? "Account" : loggedIn ? (
                    <><span className="font-semibold">Ciao,</span>{" "}{(displayName || "Account").split(" ")[0]}</>
                  ) : "Accedi"}
                </span>
              </Link>
            </div>

            <Link
              href="/carrello"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-surface px-3 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`Carrello${cartCount > 0 ? `, ${cartCount} articoli` : ""}`}
            >
              <div className="relative">
                <CartIcon />
                {cartCount > 0 && (
                  <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-contrast">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </div>
              <div className="hidden lg:flex lg:flex-col lg:leading-tight">
                <span className="text-xs text-muted-text">Totale</span>
                <span className="text-sm font-semibold text-text">{formatEUR(cartTotal)}</span>
              </div>
            </Link>
          </div>
        </div>

      </Container>

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
