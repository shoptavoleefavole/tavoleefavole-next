"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";

import Container from "@/components/Container";
import { useCart } from "@/components/cart/CartProvider";
import { formatEUR } from "@/lib/format";

function MenuIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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

function ChevronRight({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* ---------------------------
   Categorie da Strapi (robuste)
---------------------------- */
type NavSub = { slug: string; label: string };
type NavCat = { slug: string; label: string; icon?: string | null; subcategories: NavSub[] };

const STRAPI_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_BASE_URL || "";

const FETCH_TIMEOUT_MS = 8000;

function absUrl(base: string, maybeUrl: string | null | undefined) {
  if (!maybeUrl) return null;
  const u = String(maybeUrl).trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${base.replace(/\/$/, "")}${u}`;
  return u;
}

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isNavSub(x: any): x is NavSub {
  return x && typeof x === "object" && typeof x.slug === "string" && typeof x.label === "string";
}

function isNavCat(x: any): x is NavCat {
  return (
    x &&
    typeof x === "object" &&
    typeof x.slug === "string" &&
    typeof x.label === "string" &&
    Array.isArray(x.subcategories)
  );
}

function normalizeStrapiCategory(row: any): NavCat | null {
  const a = row?.attributes ?? row ?? {};
  const slug: string | undefined = a?.slug;
  if (!slug) return null;

  const label: string = a?.label ?? a?.name ?? a?.title ?? slug;

  const iconRaw =
    a?.icon?.data?.attributes?.url ??
    a?.icon?.attributes?.url ??
    a?.icon?.url ??
    a?.iconUrl ??
    a?.icon ?? // ✅ se l’API route restituisce già una stringa
    null;

  const icon = STRAPI_URL ? absUrl(STRAPI_URL, iconRaw) : iconRaw;

  const subsData = a?.subcategories?.data ?? a?.subcategories ?? [];
  const subcategories: NavSub[] = Array.isArray(subsData)
    ? subsData
        .map((s: any) => {
          const sa = s?.attributes ?? s ?? {};
          const sSlug = sa?.slug;
          if (!sSlug) return null;
          const sLabel = sa?.label ?? sa?.name ?? sa?.title ?? sSlug;
          return { slug: String(sSlug), label: String(sLabel) };
        })
        .filter(isNavSub)
    : [];

  return { slug: String(slug), label: String(label), icon, subcategories };
}

async function fetchHeaderCategoriesFromStrapi(signal?: AbortSignal): Promise<NavCat[]> {
  if (!STRAPI_URL) return [];

  const qs = new URLSearchParams();
  qs.set("populate[subcategories]", "*");
  qs.set("populate[icon]", "*");
  qs.set("pagination[pageSize]", "100");
  qs.set("sort[0]", "createdAt:asc");

  const url = `${STRAPI_URL.replace(/\/$/, "")}/api/categories?${qs.toString()}`;

  const res = await fetch(url, { cache: "no-store", signal });
  const text = await res.text().catch(() => "");
  const json = safeJsonParse(text);
  if (!res.ok) return [];

  const data: any[] = Array.isArray(json?.data) ? json.data : [];
  return data.map(normalizeStrapiCategory).filter(isNavCat);
}

async function fetchHeaderCategoriesRobust(signal?: AbortSignal): Promise<NavCat[]> {
  try {
    const res = await fetch("/api/nav/categories", { cache: "no-store", signal });
    if (res.ok) {
      const json = await res.json().catch(() => null);
      const data: any[] = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
      const normalized = data.map(normalizeStrapiCategory).filter(isNavCat);
      if (normalized.length) return normalized;
    }
  } catch {
    // noop
  }
  return fetchHeaderCategoriesFromStrapi(signal);
}

/* ---------------------------
   Header
---------------------------- */
export default function Header() {
  const { summary } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [cat, setCat] = useState(searchParams.get("categoria") ?? "");
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Drawer accordion (macro aperta)
  const [openMacroSlug, setOpenMacroSlug] = useState<string | null>(null);

  // Categorie reali
  const [categories, setCategories] = useState<NavCat[]>([]);
  const [catsLoaded, setCatsLoaded] = useState(false);

  const safeCategories = useMemo(() => (Array.isArray(categories) ? categories : []), [categories]);
  const hasManyCategories = safeCategories.length > 0;

  const drawerRef = useRef<HTMLDivElement | null>(null);

  // Portal mount flag + guard anti-hydration per badge/contatori
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const cartCount = mounted ? summary.count : 0;
  const cartTotal = mounted ? summary.total : 0;

  // fetch categorie
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const t = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    (async () => {
      try {
        const cats = await fetchHeaderCategoriesRobust(controller.signal);
        if (!alive) return;
        setCategories(cats);
      } catch {
        if (!alive) return;
        setCategories([]);
      } finally {
        window.clearTimeout(t);
        if (!alive) return;
        setCatsLoaded(true);
      }
    })();

    return () => {
      alive = false;
      window.clearTimeout(t);
      controller.abort();
    };
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const sp = new URLSearchParams(searchParams.toString());

    if (cat) sp.set("categoria", cat);
    else sp.delete("categoria");

    if (q.trim()) sp.set("q", q.trim());
    else sp.delete("q");

    const qs = sp.toString();
    router.push(qs ? `/catalogo?${qs}` : `/`);
  }

  // Reset accordion quando chiudi il drawer
  useEffect(() => {
    if (!mobileMenuOpen) setOpenMacroSlug(null);
  }, [mobileMenuOpen]);

  // Scroll lock + ESC to close (mobile drawer)
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileMenuOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileMenuOpen]);

  // ✅ Open/close drawer da BottomNav (evento globale)
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

  function closeMenu() {
    setMobileMenuOpen(false);
  }

  const drawer = mobileMenuOpen ? (
    <div className="fixed inset-0 z-[99999]" role="dialog" aria-modal="true" aria-label="Menu">
      {/* Overlay clickabile */}
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Chiudi menu" onClick={closeMenu} />

      {/* Pannello */}
      <div ref={drawerRef} className="absolute left-0 top-0 h-dvh w-[86%] max-w-[360px] bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-base font-extrabold">Menu</span>
          <button
            type="button"
            onClick={closeMenu}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Chiudi"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="h-[calc(100dvh-56px)] overflow-y-auto px-3 py-3 pb-24">
          {/* scorciatoie in alto */}
          <div className="grid grid-cols-2 gap-2 px-1">
            <Link
              href="/account"
              onClick={closeMenu}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-3 py-3 text-sm font-extrabold hover:bg-surface-2"
            >
              <UserIcon />
              Account
            </Link>

            <Link
              href="/carrello"
              onClick={closeMenu}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-3 py-3 text-sm font-extrabold hover:bg-surface-2"
            >
              <CartIcon />
              Carrello ({cartCount})
            </Link>
          </div>

          <div className="my-4 border-t border-border" />

          {/* Home + Catalogo */}
          <div className="space-y-2 px-1">
            <Link
              href="/"
              onClick={closeMenu}
              className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 text-sm font-extrabold hover:bg-surface-2"
            >
              <span>Home</span>
              <ChevronRight className="opacity-60" />
            </Link>

            <Link
              href="/catalogo"
              onClick={closeMenu}
              className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 text-sm font-extrabold hover:bg-surface-2"
            >
              <span>Catalogo</span>
              <ChevronRight className="opacity-60" />
            </Link>
          </div>

          <div className="my-4 border-t border-border" />

          {/* ✅ CATEGORIE */}
          <div className="px-1">
            <div className="px-1 text-xs font-extrabold uppercase tracking-wide text-muted-text">
              Categorie
            </div>

            {!catsLoaded ? (
              <div className="mt-3 rounded-2xl border border-border bg-background p-4 text-sm text-muted-text">
                Caricamento categorie…
              </div>
            ) : !hasManyCategories ? (
              <div className="mt-3 rounded-2xl border border-border bg-background p-4 text-sm text-muted-text">
                Nessuna categoria configurata.
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {safeCategories.map((c) => {
                  const isOpen = openMacroSlug === c.slug;
                  const hasSubs = (c.subcategories ?? []).length > 0;

                  return (
                    <li key={c.slug} className="rounded-2xl border border-border bg-background">
                      <button
                        type="button"
                        onClick={() => setOpenMacroSlug(isOpen ? null : c.slug)}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left hover:bg-surface-2"
                        aria-expanded={isOpen}
                        aria-controls={`macro-${c.slug}`}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          {c.icon ? (
                            <Image
                              src={c.icon}
                              alt=""
                              width={22}
                              height={22}
                              sizes="22px"
                              loading="lazy"
                              unoptimized
                              aria-hidden="true"
                            />
                          ) : (
                            <span className="h-[22px] w-[22px] rounded-md bg-surface-2" aria-hidden="true" />
                          )}

                          <span className="min-w-0 truncate text-sm font-extrabold">{c.label}</span>
                        </span>

                        <ChevronRight
                          className={`shrink-0 transition-transform ${
                            hasSubs && isOpen ? "rotate-90" : ""
                          } ${hasSubs ? "" : "opacity-60"}`}
                        />
                      </button>

                      {isOpen ? (
                        <div id={`macro-${c.slug}`} className="px-4 pb-3">
                          <div className="ml-8 grid gap-1">
                            <Link
                              href={`/categoria/${c.slug}`}
                              onClick={closeMenu}
                              className="rounded-xl px-3 py-2 text-sm font-semibold hover:bg-surface-2"
                            >
                              Tutti
                            </Link>

                            {(c.subcategories ?? []).map((sub) => (
                              <Link
                                key={sub.slug}
                                href={`/categoria/${c.slug}/${sub.slug}`}
                                onClick={closeMenu}
                                className="rounded-xl px-3 py-2 text-sm font-semibold hover:bg-surface-2"
                              >
                                {sub.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="h-8" />
        </div>
      </div>
    </div>
  ) : null;

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

          <form
            onSubmit={onSubmit}
            className="flex flex-1 items-center overflow-hidden rounded-full border border-border bg-white h-11"
          >
            <div className="flex items-center border-r border-border h-11">
              <select
                value={cat}
                onChange={(e) => setCat(e.target.value)}
                aria-label="Categoria"
                className="h-11 bg-transparent px-3 text-sm outline-none cursor-pointer"
              >
                <option value="">Tutte</option>
                {!catsLoaded ? <option disabled>Caricamento…</option> : null}
                {safeCategories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cerca..."
              className="h-11 flex-1 px-3 text-sm outline-none"
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
        <form
          onSubmit={onSubmit}
          className="md:hidden pb-3 flex h-11 items-center overflow-hidden rounded-full border border-border bg-white"
        >
          <div className="flex items-center border-r border-border h-11">
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              aria-label="Categoria"
              className="h-11 bg-transparent px-3 text-sm outline-none cursor-pointer"
            >
              <option value="">Tutte</option>
              {!catsLoaded ? <option disabled>Caricamento…</option> : null}
              {safeCategories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca..."
            className="h-11 flex-1 px-3 text-sm outline-none"
          />

          <button
            type="submit"
            className="h-11 px-5 text-sm font-extrabold bg-primary text-primary-contrast hover:bg-primary-hover transition"
          >
            Cerca
          </button>
        </form>
      </Container>

      {/* ✅ Drawer via Portal: fullscreen garantito */}
      {mounted && drawer ? createPortal(drawer, document.body) : null}
    </header>
  );
}
