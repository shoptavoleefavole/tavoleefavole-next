"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";

function ChevronDownIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M5 7.5L10 12.5L15 7.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Pos = { top: number; left: number; width: number } | null;
type NavSub = { slug: string; label: string };
type NavCat = { slug: string; label: string; icon?: string | null; subcategories: NavSub[] };

type NavOcc = {
  slug: string;
  label: string;
  startDate?: string | null;
  endDate?: string | null;
};

const STRAPI_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_BASE_URL || "";

const FETCH_TIMEOUT_MS = 8000;

function absUrl(base: string, maybeUrl: string | null | undefined) {
  if (!maybeUrl) return null;
  const u = String(maybeUrl).trim();
  if (!u) return null;

  if (
    u.startsWith("http://") ||
    u.startsWith("https://") ||
    u.startsWith("data:") ||
    u.startsWith("blob:")
  ) {
    return u;
  }

  const baseClean = String(base || "").replace(/\/+$/, "");
  if (!baseClean) return u;

  if (u.startsWith("/")) return `${baseClean}${u}`;
  return `${baseClean}/${u.replace(/^\/+/, "")}`;
}

function safeJsonParse(text: string): any {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function fetchJsonSafe(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text().catch(() => "");
  const json = safeJsonParse(text);
  return { ok: res.ok, status: res.status, json, text };
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

  const slugRaw = a?.slug ?? a?.documentId ?? null;
  const slug = typeof slugRaw === "string" ? slugRaw.trim() : null;
  if (!slug) return null;

  const labelRaw = a?.label ?? a?.name ?? a?.title ?? slug;
  const label = String(labelRaw ?? slug).trim() || slug;

  const iconRaw =
    (typeof a?.icon === "string" ? a.icon : null) ??
    a?.icon?.data?.attributes?.url ??
    a?.icon?.attributes?.url ??
    a?.icon?.url ??
    a?.iconUrl ??
    null;

  const icon = STRAPI_URL ? absUrl(STRAPI_URL, iconRaw) : (iconRaw as any);

  const subsData = a?.subcategories?.data ?? a?.subcategories ?? [];
  const subcategories: NavSub[] = Array.isArray(subsData)
    ? subsData
        .map((s: any) => {
          const sa = s?.attributes ?? s ?? {};
          const sSlug = sa?.slug;
          if (!sSlug) return null;
          const sLabel = sa?.label ?? sa?.name ?? sa?.title ?? sSlug;
          return {
            slug: String(sSlug).trim(),
            label: String(sLabel ?? sSlug).trim() || String(sSlug),
          };
        })
        .filter(isNavSub)
    : [];

  return { slug, label, icon: icon ?? null, subcategories };
}

function isNavOcc(x: any): x is NavOcc {
  return x && typeof x === "object" && typeof x.slug === "string" && typeof x.label === "string";
}

function normalizeStrapiOccasion(row: any): NavOcc | null {
  const a = row?.attributes ?? row ?? {};
  const slugRaw = a?.slug ?? a?.documentId ?? null;
  const slug = typeof slugRaw === "string" ? slugRaw.trim() : null;
  if (!slug) return null;
  const labelRaw = a?.Titolo ?? a?.titolo ?? a?.title ?? a?.label ?? a?.name ?? slug;
  const label = String(labelRaw ?? slug).trim() || slug;
  return {
    slug,
    label,
    startDate: a?.startDate ?? null,
    endDate: a?.endDate ?? null,
  };
}

async function fetchNavbarOccasionsRobust(signal?: AbortSignal): Promise<NavOcc[]> {
  // 1) Rotta interna Next.js
  try {
    const { ok, json } = await fetchJsonSafe("/api/nav/occasions", { cache: "no-store", signal });
    if (ok) {
      const data: any[] = Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.occasions)
          ? json.occasions
          : Array.isArray(json)
            ? json
            : [];
      const normalized = data.map(normalizeStrapiOccasion).filter(isNavOcc);
      if (normalized.length) return normalized;
    }
  } catch { /* noop */ }

  // 2) Fallback diretto su Strapi
  if (!STRAPI_URL) return [];

  // ✅ Fix: qs dichiarato fuori dal try per chiarezza di scope
  const strapiQs = new URLSearchParams();
  strapiQs.set("pagination[pageSize]", "50");
  strapiQs.set("sort[0]", "createdAt:asc");
  const strapiUrl = `${STRAPI_URL.replace(/\/$/, "")}/api/occasions?${strapiQs.toString()}`;

  try {
    const { ok, json } = await fetchJsonSafe(strapiUrl, { cache: "no-store", signal });
    if (!ok) return [];
    const data: any[] = Array.isArray(json?.data) ? json.data : [];
    return data.map(normalizeStrapiOccasion).filter(isNavOcc);
  } catch {
    return [];
  }
}

/** Filtra le occasioni attive in base alle date di Strapi */
function isOccasionActive(o: NavOcc): boolean {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (o.startDate) {
    const start = new Date(o.startDate);
    if (now < start) return false;
  }
  if (o.endDate) {
    const end = new Date(o.endDate);
    end.setHours(23, 59, 59, 999);
    if (now > end) return false;
  }
  return true;
}

async function fetchNavbarCategoriesFromStrapi(signal?: AbortSignal): Promise<NavCat[]> {
  if (!STRAPI_URL) return [];

  const qs = new URLSearchParams();
  qs.set("populate[subcategories]", "*");
  qs.set("populate[icon]", "*");
  qs.set("pagination[pageSize]", "100");
  qs.set("sort[0]", "createdAt:asc");

  const url = `${STRAPI_URL.replace(/\/$/, "")}/api/categories?${qs.toString()}`;
  const { ok, json } = await fetchJsonSafe(url, { cache: "no-store", signal });
  if (!ok) return [];

  const data: any[] = Array.isArray(json?.data) ? json.data : [];
  return data.map(normalizeStrapiCategory).filter(isNavCat);
}

async function fetchNavbarCategoriesRobust(signal?: AbortSignal): Promise<NavCat[]> {
  try {
    const { ok, json } = await fetchJsonSafe("/api/nav/categories", { cache: "no-store", signal });
    if (ok) {
      const data: any[] = Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.categories)
          ? json.categories
          : Array.isArray(json)
            ? json
            : [];

      const normalized = data.map(normalizeStrapiCategory).filter(isNavCat);
      if (normalized.length) return normalized;
    }
  } catch {
    // noop
  }

  return fetchNavbarCategoriesFromStrapi(signal);
}

export default function Navbar() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  const [categories, setCategories] = useState<NavCat[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [occasions, setOccasions] = useState<NavOcc[]>([]);

  // fetch occasions
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const t = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    (async () => {
      try {
        const occs = await fetchNavbarOccasionsRobust(controller.signal);
        if (!alive) return;
        setOccasions(Array.isArray(occs) ? occs : []);
      } catch {
        if (!alive) return;
        setOccasions([]);
      } finally {
        window.clearTimeout(t);
      }
    })();
    return () => { alive = false; window.clearTimeout(t); controller.abort(); };
  }, []);

  const activeOccasions = useMemo(
    () => occasions.filter(isOccasionActive),
    [occasions]
  );

  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const openElRef = useRef<HTMLButtonElement | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<Pos>(null);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const activeMacroSlug = (() => {
    const parts = (pathname ?? "").split("/").filter(Boolean);
    if (parts[0] !== "categoria") return null;
    return parts[1] ?? null;
  })();

  // chiudi dropdown quando cambi pagina
  useEffect(() => {
    setOpenSlug(null);
    setPos(null);
    openElRef.current = null;
  }, [pathname]);

  // fetch categories
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const t = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    (async () => {
      try {
        const cats = await fetchNavbarCategoriesRobust(controller.signal);
        if (!alive) return;
        setCategories(Array.isArray(cats) ? cats : []);
      } catch {
        if (!alive) return;
        setCategories([]);
      } finally {
        window.clearTimeout(t);
        if (!alive) return;
        setLoaded(true);
      }
    })();

    return () => {
      alive = false;
      window.clearTimeout(t);
      controller.abort();
    };
  }, []);

  function updatePosFromEl(el: HTMLButtonElement | null) {
    if (!el) return setPos(null);

    const r = el.getBoundingClientRect();
    const width = 360;
    const gutter = 12;

    let left = r.left;
    const maxLeft = window.innerWidth - width - gutter;
    left = Math.max(gutter, Math.min(left, maxLeft));

    const top = r.bottom + 10;
    setPos({ top, left, width });
  }

  useEffect(() => {
    if (!openSlug) return setPos(null);
    updatePosFromEl(openElRef.current);
  }, [openSlug]);

  useEffect(() => {
    if (!openSlug) return;

    const onAnyScroll = () => updatePosFromEl(openElRef.current);
    const onResize = () => updatePosFromEl(openElRef.current);

    window.addEventListener("scroll", onAnyScroll, true);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("scroll", onAnyScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [openSlug]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenSlug(null);
        setPos(null);
        openElRef.current = null;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // chiudi quando clicchi fuori
  useEffect(() => {
    if (!openSlug) return;

    function onDocPointerDown(e: PointerEvent) {
      const panel = panelRef.current;
      const trg = openElRef.current;

      const t = e.target;
      if (!(t instanceof Node)) return;

      if (panel && panel.contains(t)) return;
      if (trg && trg.contains(t)) return;

      setOpenSlug(null);
      setPos(null);
      openElRef.current = null;
    }

    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () => document.removeEventListener("pointerdown", onDocPointerDown, true);
  }, [openSlug]);

  function measureOverflow() {
    const el = scrollerRef.current;
    if (!el) return;
    setIsOverflowing(el.scrollWidth > el.clientWidth + 8);
  }

  // ✅ aggiunto activeOccasions.length per ricalcolare overflow quando il tasto Pasqua appare/sparisce
  useEffect(() => {
    measureOverflow();
  }, [categories.length, activeOccasions.length]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onResize = () => measureOverflow();
    window.addEventListener("resize", onResize);

    const raf = window.requestAnimationFrame(() => measureOverflow());

    return () => {
      window.removeEventListener("resize", onResize);
      window.cancelAnimationFrame(raf);
    };
  }, []);

  const desktopRow = (
    <div className="hidden md:block py-3">
      <div className="relative">
        <div
          ref={scrollerRef}
          className="no-scrollbar overflow-x-auto scroll-smooth pl-0 pr-4 md:pl-0 md:pr-6 scroll-px-0"
          aria-label="Categorie"
        >
          <ul className="flex w-max items-stretch gap-1.4 md:gap-2.4 py-1 pr-10 pl-0">

            {/* ✅ OCCASIONI ATTIVE DA STRAPI (filtrate per data) */}
            {activeOccasions.map((o) => {
              const isActive = pathname.startsWith(`/occasione/${o.slug}`);
              const isPasqua = o.slug === "pasqua";

              return (
                <li key={`occ-${o.slug}`} className="shrink-0">
                  <Link
                    href={`/occasione/${o.slug}`}
                    className={[
                      "inline-flex items-center justify-center gap-2",
                      "rounded-2xl border",
                      "px-3 py-2 sm:px-4 sm:py-3",
                      "whitespace-nowrap leading-none",
                      "text-[13px] sm:text-[14px] md:text-[15px] font-bold tracking-tight",
                      "transition-colors transition-shadow duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DCAE54]",
                      isPasqua
                        ? isActive
                          ? "border-[#DCAE54] bg-[#F5E6A3] shadow-sm text-[#5C3D00]"
                          : "border-[#DCAE54]/70 bg-[#F5E6A3]/60 hover:bg-[#F0D980]/70 text-[#5C3D00]"
                        : isActive
                          ? "border-primary/30 bg-primary/5 shadow-sm text-text"
                          : "border-border/70 bg-background hover:bg-surface-2 text-text",
                    ].join(" ")}
                    aria-current={isActive ? "page" : undefined}
                    title={o.label}
                    onClick={() => {
                      setOpenSlug(null);
                      setPos(null);
                      openElRef.current = null;
                    }}
                  >
                    {/* Icona */}
                    <span
                      className={[
                        "grid h-[20px] w-[20px] sm:h-[22px] sm:w-[22px] place-items-center rounded-lg",
                        isPasqua ? "bg-[#DCAE54]/40" : "bg-surface-2",
                      ].join(" ")}
                      aria-hidden="true"
                    >
                      {isPasqua ? (
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path
                            d="M12 2.6c-3.7 0-6.7 5.1-6.7 10.5 0 5.7 3 8.4 6.7 8.4s6.7-2.7 6.7-8.4c0-5.4-3-10.5-6.7-10.5Z"
                            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                          />
                          <path
                            d="M7.7 12.1l1.5-1.2 1.5 1.2 1.5-1.2 1.5 1.2 1.5-1.2"
                            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                          />
                          <path
                            d="M9 15.6h.01M12 16.4h.01M15 15.6h.01"
                            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
                          />
                        </svg>
                      ) : (
                        <span>✨</span>
                      )}
                    </span>

                    {/* Label */}
                    <span className="max-w-[110px] sm:max-w-[140px] md:max-w-none truncate">
                      {o.label}
                    </span>

                    {/* Badge solo per Pasqua */}
                    {isPasqua && (
                      <span className="ml-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold bg-[#8B5E00] text-[#FFF8E1]">
                        Offerte
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}

            {/* CATEGORIE (dropdown SOLO CLICK) */}
            {categories.filter((cat) => String(cat.slug).toLowerCase() !== "pasqua").map((cat) => {
              const hasSubs = cat.subcategories.length > 0;
              const isOpen = openSlug === cat.slug;
              const isActive =
                activeMacroSlug === cat.slug || pathname.startsWith(`/categoria/${cat.slug}`);

              const pillBase = [
                "inline-flex items-center justify-center gap-2",
                "rounded-full border",
                "px-3 py-2 sm:px-4 sm:py-3",
                "whitespace-nowrap leading-none",
                "text-[13px] sm:text-[14px] md:text-[15px] font-bold tracking-tight",
                "transition-colors transition-shadow duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              ].join(" ");

              const pillState = isActive
                ? "border-primary/30 bg-primary/5 shadow-sm"
                : "border-line/10 bg-surface-1/85 hover:bg-surface-1 hover:shadow-soft";

              return (
                <li key={cat.slug} className="shrink-0">
                  <button
                    type="button"
                    aria-current={isActive ? "page" : undefined}
                    aria-expanded={hasSubs ? isOpen : undefined}
                    aria-haspopup={hasSubs ? "menu" : undefined}
                    title={cat.label}
                    className={`${pillBase} ${pillState}`}
                    onClick={(e) => {
                      if (hasSubs) {
                        openElRef.current = e.currentTarget;
                        setOpenSlug((cur) => (cur === cat.slug ? null : cat.slug));
                        updatePosFromEl(e.currentTarget);
                      } else {
                        setOpenSlug(null);
                        setPos(null);
                        openElRef.current = null;
                        router.push(`/categoria/${cat.slug}`);
                      }
                    }}
                  >
                    {cat.icon ? (
                      <Image
                        src={cat.icon}
                        alt=""
                        width={22}
                        height={22}
                        sizes="22px"
                        loading="lazy"
                        aria-hidden="true"
                      />
                    ) : (
                      <span
                        className="h-[20px] w-[20px] sm:h-[22px] sm:w-[22px] rounded-lg bg-surface-2"
                        aria-hidden="true"
                      />
                    )}

                    <span className="max-w-[120px] sm:max-w-[160px] md:max-w-none truncate text-text">
                      {cat.label}
                    </span>

                    {hasSubs ? (
                      <ChevronDownIcon
                        className={`h-4 w-4 shrink-0 text-text/70 transition-transform ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {isOverflowing ? (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-background via-background/40 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background via-background/40 to-transparent" />
          </>
        ) : null}

        {!STRAPI_URL ? (
          <div className="mt-2 px-4 text-xs text-text/50">STRAPI_URL non configurato (NEXT_PUBLIC_STRAPI_URL).</div>
        ) : null}

        {!loaded ? (
          <div className="mt-2 px-4 text-xs text-text/50">
            Caricamento categorie… (max {Math.round(FETCH_TIMEOUT_MS / 1000)}s)
          </div>
        ) : null}

        {loaded && categories.length === 0 ? (
          <div className="mt-2 px-4 text-xs text-text/50">
            Nessuna categoria trovata (o Strapi non raggiungibile).
          </div>
        ) : null}
      </div>
    </div>
  );

  const portalDropdown =
    mounted && openSlug && pos ? (
      createPortal(
        <div
          ref={panelRef}
          className={[
            "fixed z-[100000] rounded-2xl border border-line/10",
            "bg-surface-1/95 backdrop-blur",
            "p-2 shadow-xl",
          ].join(" ")}
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          role="menu"
          aria-label="Sottocategorie"
        >
          {(() => {
            const cat = categories.find((c) => c.slug === openSlug);
            const subs = cat?.subcategories ?? [];
            if (!cat || subs.length === 0) return null;

            return (
              <ul className="space-y-1">
                <li>
                  <Link
                    href={`/categoria/${cat.slug}`}
                    role="menuitem"
                    className="block rounded-xl px-4 py-3 text-sm font-semibold hover:bg-surface-2"
                    onClick={() => {
                      setOpenSlug(null);
                      setPos(null);
                      openElRef.current = null;
                    }}
                  >
                    Tutti {cat.label}
                  </Link>
                </li>

                {subs.map((sub) => (
                  <li key={sub.slug}>
                    <Link
                      href={`/categoria/${cat.slug}/${sub.slug}`}
                      role="menuitem"
                      className="block rounded-xl px-4 py-3 text-sm font-semibold hover:bg-surface-2"
                      onClick={() => {
                        setOpenSlug(null);
                        setPos(null);
                        openElRef.current = null;
                      }}
                    >
                      {sub.label}
                    </Link>
                  </li>
                ))}
              </ul>
            );
          })()}
        </div>,
        document.body
      )
    ) : null;

  return (
    <nav aria-label="Categorie" className="relative">
      {desktopRow}
      {portalDropdown}
    </nav>
  );
}
