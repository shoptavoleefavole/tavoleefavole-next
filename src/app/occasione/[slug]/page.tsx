import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import ProductsGridWithFilters from "@/components/catalog/ProductsGridWithFilters";
import Breadcrumbs from "@/components/Breadcrumbs";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const STRAPI_URL =
  process.env.STRAPI_URL ||
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  "http://localhost:1337";

const STRAPI_TOKEN =
  process.env.STRAPI_API_TOKEN || process.env.STRAPI_TOKEN || "";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.tavoleefavole.com")
).replace(/\/+$/, "");

const PAGE_SIZE = 200;

type OccasionTheme = {
  label: string;
  heroTitle: string;
  badgeColor: string;
  bg: string;
};

type OccasionData = {
  slug: string;
  label: string;
  heroTitle: string;
  badgeColor: string;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  categorySlugs: string[];
};

// ─── utils ────────────────────────────────────────────────────────────────────

function normalizedStrapiBaseUrl() {
  let base = String(STRAPI_URL || "").trim().replace(/\/+$/, "");
  if (!base) return "";
  const isLocal =
    base.includes("localhost") ||
    base.includes("127.0.0.1") ||
    base.includes("0.0.0.0");
  if (process.env.NODE_ENV === "production" && isLocal) return "";
  if (process.env.NODE_ENV === "production" && !isLocal) {
    base = base.replace(/^http:\/\//i, "https://");
  }
  return base;
}

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function safeStr(v: unknown, fallback = "") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function absUrl(base: string, maybeUrl: string | null | undefined) {
  if (!maybeUrl) return null;
  const u = String(maybeUrl).trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("//")) return `https:${u}`;
  if (u.startsWith("/")) return `${base.replace(/\/$/, "")}${u}`;
  return u;
}

function isRetryableFetchError(e: any) {
  const code = e?.cause?.code || e?.code;
  return (
    e?.name === "AbortError" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "EAI_AGAIN" ||
    String(e?.message || "").toLowerCase().includes("fetch failed")
  );
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 15_000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(t);
  }
}

async function fetchWithRetry(url: string, init: RequestInit = {}, ms = 15_000) {
  let lastErr: any;
  for (let i = 0; i < 3; i++) {
    try {
      return await fetchWithTimeout(url, init, ms);
    } catch (e: any) {
      lastErr = e;
      if (!isRetryableFetchError(e) || i === 2) break;
      await new Promise((r) => setTimeout(r, 400 * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

async function fetchStrapi(path: string) {
  const base = normalizedStrapiBaseUrl();
  if (!base) return { ok: false, status: 500, json: null, base: "" };

  const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;

  const tryFetch = async (withAuth: boolean) => {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (withAuth && STRAPI_TOKEN) headers.Authorization = `Bearer ${STRAPI_TOKEN}`;
    const res = await fetchWithRetry(url, { headers });
    const text = await res.text().catch(() => "");
    const json = text ? safeJsonParse(text) : null;
    return { ok: res.ok, status: res.status, json, base };
  };

  try {
    if (STRAPI_TOKEN) {
      const r1 = await tryFetch(true);
      if (r1.ok) return r1;
      if (r1.status !== 401 && r1.status !== 403) return r1;
    }
    return await tryFetch(false);
  } catch {
    return { ok: false, status: 0, json: null, base };
  }
}

function todayYMDRome() {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function isOccasionCurrentlyActive(occasion: {
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
}) {
  if (occasion.isActive) return true;

  const today = todayYMDRome();
  const start = safeStr(occasion.startDate, "");
  const end = safeStr(occasion.endDate, "");

  if (!start && !end) return false;
  if (start && !end) return today >= start;
  if (!start && end) return today <= end;
  return today >= start && today <= end;
}

function hexToRgba(hex: string, alpha: number) {
  const clean = String(hex || "").trim().replace("#", "");
  const normalized =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean.length === 6
        ? clean
        : "DCAE54";

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildOccasionTheme(occasion: OccasionData): OccasionTheme {
  const fallbackColor = occasion.slug === "natale" ? "#B2182B" : "#DCAE54";
  const color = safeStr(occasion.badgeColor, fallbackColor);
  return {
    label: occasion.label,
    heroTitle: safeStr(
      occasion.heroTitle,
      occasion.slug === "natale"
        ? "Speciale Natale: dolcezze artigianali, idee regalo e specialità delle feste."
        : occasion.label
    ),
    badgeColor: color,
    bg:
      `radial-gradient(ellipse at 15% 10%, ${hexToRgba(color, 0.16)} 0%, transparent 48%),` +
      `radial-gradient(ellipse at 85% 12%, rgba(212, 175, 55, 0.14) 0%, transparent 44%),` +
      `linear-gradient(160deg, #fffdf8 0%, #fffaf2 45%, #ffffff 100%)`,
  };
}

// ─── Business check ───────────────────────────────────────────────────────────

async function checkIsBusiness(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const tf = cookieStore.get("tf_token")?.value ?? null;
    if (!tf || tf.split(".").length !== 3) return false;

    const res = await fetchWithTimeout(
      `${SITE_URL}/api/account/type`,
      { headers: { Cookie: cookieStore.toString() }, cache: "no-store" },
      8_000
    );

    if (!res.ok) return false;

    const json = safeJsonParse(await res.text().catch(() => ""));
    const ct = String(json?.customerType ?? "").toUpperCase();
    return ct === "AZIENDE" || ct === "BUSINESS";
  } catch {
    return false;
  }
}

// ─── Occasion helpers ─────────────────────────────────────────────────────────

function normalizeOccasion(row: any): OccasionData | null {
  const a = row?.attributes ?? row ?? {};

  const slug = safeStr(a?.slug ?? a?.documentId, "").toLowerCase();
  if (!slug) return null;

  const categoriesRaw = a?.categories?.data ?? a?.categories ?? [];
  const categorySlugs = Array.isArray(categoriesRaw)
    ? categoriesRaw
        .map((c: any) => {
          const ca = c?.attributes ?? c ?? {};
          return safeStr(ca?.slug, "");
        })
        .filter(Boolean)
    : [];

  return {
    slug,
    label: safeStr(a?.Titolo ?? a?.titolo ?? a?.title ?? a?.label ?? a?.name, slug),
    heroTitle: safeStr(a?.heroTitle, ""),
    badgeColor: safeStr(a?.badgeColor, slug === "natale" ? "#B2182B" : "#DCAE54"),
    isActive: a?.isActive === true,
    startDate: a?.startDate ?? null,
    endDate: a?.endDate ?? null,
    categorySlugs: Array.from(new Set(categorySlugs)),
  };
}

async function fetchOccasionBySlug(slug: string): Promise<OccasionData | null> {
  const target = slug.trim().toLowerCase();

  const qs = new URLSearchParams();
  qs.set("filters[slug][$eqi]", target);
  qs.set("pagination[pageSize]", "1");
  qs.set("populate[categories][fields][0]", "slug");
  qs.set("populate[categories][fields][1]", "label");

  const r = await fetchStrapi(`/api/occasions?${qs.toString()}`);
  if (r.ok) {
    const data: any[] = Array.isArray(r.json?.data) ? r.json.data : [];
    if (data.length) return normalizeOccasion(data[0]);
  }

  // Fallback: scarica le occasioni e confronta lo slug normalizzato
  const qsAll = new URLSearchParams();
  qsAll.set("pagination[pageSize]", "100");
  qsAll.set("populate[categories][fields][0]", "slug");
  qsAll.set("populate[categories][fields][1]", "label");

  const rAll = await fetchStrapi(`/api/occasions?${qsAll.toString()}`);
  if (!rAll.ok) return null;

  const allRows: any[] = Array.isArray(rAll.json?.data) ? rAll.json.data : [];
  const normalizedList = allRows
    .map(normalizeOccasion)
    .filter((o): o is OccasionData => Boolean(o));

  return normalizedList.find((o) => o.slug === target) ?? null;
}

// ─── Prodotti helpers ─────────────────────────────────────────────────────────

function getDefaultSku(item: any): string | null {
  return item?.variants?.[0]?.sku ?? item?.variant?.sku ?? null;
}

function extractMediaUrls(base: string, media: any): string[] {
  if (!media) return [];
  const data = media?.data ?? media;
  const arr = Array.isArray(data) ? data : [data];

  return arr
    .map((node: any) => {
      const a = node?.attributes ?? node ?? {};
      const f = a?.formats ?? null;
      const u =
        f?.large?.url ??
        f?.medium?.url ??
        f?.small?.url ??
        f?.thumbnail?.url ??
        a?.url ??
        node?.url ??
        null;
      return absUrl(base, u) || "";
    })
    .filter(Boolean);
}

function normalizeProduct(row: any, base: string) {
  const a = row?.attributes ?? row ?? {};
  const slug = safeStr(a?.slug);
  const id = safeStr(row?.documentId ?? row?.id ?? a?.documentId ?? a?.id, slug || "0");

  const images =
    extractMediaUrls(base, a?.images).length ? extractMediaUrls(base, a?.images) :
    extractMediaUrls(base, a?.image).length ? extractMediaUrls(base, a?.image) :
    extractMediaUrls(base, a?.cover).length ? extractMediaUrls(base, a?.cover) :
    extractMediaUrls(base, a?.thumbnail);

  const variantsData = a?.variants?.data ?? a?.variants ?? [];
  const variants = Array.isArray(variantsData)
    ? variantsData
        .map((v: any) => {
          const va = v?.attributes ?? v ?? {};
          return va?.sku ? { sku: String(va.sku) } : null;
        })
        .filter(Boolean)
    : [];

  const rawPriceAziende = a?.priceAziende ?? null;
  const priceAziende =
    rawPriceAziende !== null && Number.isFinite(Number(rawPriceAziende))
      ? Number(rawPriceAziende)
      : null;

  return {
    id: String(id),
    documentId: row?.documentId ?? a?.documentId ?? null,
    slug,
    name: safeStr(a?.name ?? a?.title, "Prodotto"),
    price: typeof a?.price === "number" ? a.price : Number(a?.price ?? 0),
    compareAtPrice: a?.compareAtPrice ?? null,
    priceAziende,
    shortDescription: a?.shortDescription ?? "",
    inStock: typeof a?.inStock === "boolean" ? a.inStock : undefined,
    images: images.length ? images : undefined,
    image: images[0] || undefined,
    variants: variants.length ? variants : undefined,
    stockQty: a?.stockQty ?? null,
    trackInventory: a?.trackInventory ?? null,
    createdAt: a?.createdAt ?? row?.createdAt ?? null,
  };
}

async function fetchOccasionProducts(occasionSlug: string, categorySlugs: string[]) {
  const base = normalizedStrapiBaseUrl();
  const uniqueSlugs = Array.from(new Set([occasionSlug, ...categorySlugs].filter(Boolean)));
  const results = new Map<string, any>();

  const queries: URLSearchParams[] = [];

  // 1) Prodotti collegati direttamente all'occasione tramite visibilityOccasion
  if (occasionSlug) {
    const qsOcc = new URLSearchParams();
    qsOcc.set("pagination[pageSize]", String(PAGE_SIZE));
    qsOcc.set("sort[0]", "createdAt:desc");
    qsOcc.set("filters[visibilityOccasion][slug][$eqi]", occasionSlug);
    qsOcc.set("populate", "*");
    queries.push(qsOcc);
  }

  // 2) Prodotti collegati alle categorie (o sottocategorie) associate all'occasione
  for (const categorySlug of uniqueSlugs) {
    const qsCat = new URLSearchParams();
    qsCat.set("pagination[pageSize]", String(PAGE_SIZE));
    qsCat.set("sort[0]", "createdAt:desc");
    qsCat.set("filters[category][slug][$eqi]", categorySlug);
    qsCat.set("populate", "*");
    queries.push(qsCat);

    const qsSubCat = new URLSearchParams();
    qsSubCat.set("pagination[pageSize]", String(PAGE_SIZE));
    qsSubCat.set("sort[0]", "createdAt:desc");
    qsSubCat.set("filters[subcategory][category][slug][$eqi]", categorySlug);
    qsSubCat.set("populate", "*");
    queries.push(qsSubCat);
  }

  const responses = await Promise.all(
    queries.map((qs) => fetchStrapi(`/api/products?${qs.toString()}`))
  );

  for (const r of responses) {
    if (!r.ok) continue;
    const data: any[] = Array.isArray(r.json?.data) ? r.json.data : [];
    for (const row of data) {
      const normalized = normalizeProduct(row, r.base || base);
      if (!normalized.slug) continue;
      const key = normalized.documentId || normalized.id || normalized.slug;
      if (!results.has(String(key))) {
        results.set(String(key), normalized);
      }
    }
  }

  return Array.from(results.values());
}

async function safeGetAvailabilityOrNull(skus: string[]) {
  if (!skus.length) return null;
  try {
    const mod = await import("@/lib/inventory.server");
    if (!mod?.getAvailability) return null;
    return await mod.getAvailability({ skus, warehouse: "MAIN" });
  } catch {
    return null;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function OccasionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: slugParam } = await params;
  const slug = String(slugParam ?? "").trim().toLowerCase();
  if (!slug) return notFound();

  const occasion = await fetchOccasionBySlug(slug);
  if (!occasion) return notFound();
  if (!isOccasionCurrentlyActive(occasion)) return notFound();

  const theme = buildOccasionTheme(occasion);

  const [isBusiness, items] = await Promise.all([
    checkIsBusiness(),
    fetchOccasionProducts(occasion.slug, occasion.categorySlugs).catch(() => []),
  ]);

  const skus = Array.from(
    new Set(
      items
        .map((it: any) => getDefaultSku(it))
        .filter((s: unknown): s is string => typeof s === "string" && s.length > 0)
    )
  );

  const availability = await safeGetAvailabilityOrNull(skus);
  const bySku = (availability as any)?.data?.MAIN ?? {};

  const itemsWithStock = items.map((it: any) => {
    const sku = getDefaultSku(it);
    const row = sku ? (bySku?.[sku] ?? null) : null;
    const available = row ? Number(row.available) : Number.NaN;
    const known = !!row && Number.isFinite(available);

    return {
      ...it,
      inStock: sku ? (known ? available > 0 : true) : Boolean(it?.inStock ?? true),
      inventory: row,
      sku,
      priceAziende: isBusiness ? (it?.priceAziende ?? null) : null,
    };
  });

  const hasProducts = itemsWithStock.length > 0;
  const isChristmasOccasion = occasion.slug === "natale";

  return (
    <div className="relative min-h-screen" style={{ background: theme.bg }}>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Catalogo", href: "/catalogo" },
            { label: theme.label },
          ]}
        />

        <div className="mt-4 flex flex-col gap-3 rounded-3xl border border-border bg-white/85 p-6 shadow-sm backdrop-blur-sm sm:flex-row sm:items-end sm:justify-between sm:p-8">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-extrabold text-primary">
              <span aria-hidden="true">{isChristmasOccasion ? "🎄" : "✨"}</span>
              <span>Selezione stagionale</span>
            </span>

            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-text sm:text-4xl">
              {theme.label}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text/75 sm:text-base">
              {theme.heroTitle || "Filtra e ordina i prodotti della selezione."}
            </p>
          </div>

          <Link
            href="/catalogo"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background px-5 text-sm font-extrabold text-text transition hover:bg-surface-2"
          >
            Vedi tutto il catalogo
          </Link>
        </div>

        {!hasProducts ? (
          <div className="mt-6 rounded-3xl border border-border bg-white/90 p-6 shadow-sm backdrop-blur-sm sm:p-8">
            <p className="text-base font-extrabold text-text">
              {isChristmasOccasion
                ? "Stiamo preparando le specialità di Natale!"
                : "Nessun prodotto disponibile per questa occasione al momento."}
            </p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-text/70">
              {isChristmasOccasion
                ? "A breve troverai qui panettoni artigianali, idee regalo, cioccolato e dolcezze natalizie. Nel frattempo puoi esplorare tutto il nostro catalogo o scriverci su WhatsApp per richieste personalizzate."
                : "Prova un'altra categoria oppure torna al catalogo completo."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/catalogo"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover"
              >
                Esplora il catalogo
              </Link>
              <Link
                href="/contatti"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background px-5 text-sm font-extrabold hover:bg-surface-2"
              >
                Contattaci
              </Link>
            </div>
          </div>
        ) : (
          <ProductsGridWithFilters
            items={itemsWithStock as any}
            emptyText="Nessun prodotto trovato per questa occasione."
          />
        )}
      </div>
    </div>
  );
}