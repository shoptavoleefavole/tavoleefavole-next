// src/app/categoria/[macro]/[sub]/page.tsx

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
  process.env.STRAPI_API_TOKEN ||
  process.env.STRAPI_TOKEN ||
  "";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://tavoleefavole-next-t7pd.vercel.app"
).replace(/\/+$/, "");

const FETCH_TIMEOUT_MS = (() => {
  const n = Number(process.env.CATEGORY_STRAPI_TIMEOUT_MS ?? 25000);
  return Number.isFinite(n) ? Math.max(8000, n) : 25000;
})();

const PAGE_SIZE = 200;

// ─── utils ────────────────────────────────────────────────────────────────────

function safeDecode(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
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

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

async function fetchWithRetry(url: string, init: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  let lastErr: any;
  for (let i = 0; i < 3; i++) {
    try {
      return await fetchWithTimeout(url, init, timeoutMs);
    } catch (e: any) {
      lastErr = e;
      if (!isRetryableFetchError(e) || i === 2) break;
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

type StrapiFetchResult = {
  ok: boolean;
  status: number;
  json: any;
  base: string;
  isValidation: boolean;
};

async function fetchStrapi(path: string): Promise<StrapiFetchResult> {
  const base = normalizedStrapiBaseUrl();
  if (!base) return { ok: false, status: 500, json: null, base: "", isValidation: false };

  const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (STRAPI_TOKEN) headers.Authorization = `Bearer ${STRAPI_TOKEN}`;

  try {
    const res = await fetchWithRetry(url, { headers });
    const text = await res.text().catch(() => "");
    const json = text ? safeJsonParse(text) : null;
    const isValidation = res.status === 400 && json?.error?.name === "ValidationError";

    if (!res.ok && process.env.NODE_ENV === "development") {
      console.warn("[categoria/sub] Strapi not ok:", res.status, String(text || "").slice(0, 300));
    }

    return { ok: res.ok, status: res.status, json, base, isValidation };
  } catch (e: any) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[categoria/sub] fetch failed:", e?.message || e);
    }
    return { ok: false, status: 0, json: null, base, isValidation: false };
  }
}

// ─── Business user check ──────────────────────────────────────────────────────

async function checkIsBusiness(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const tf = cookieStore.get("tf_token")?.value ?? null;
    if (!tf) return false;

    const res = await fetchWithTimeout(
      `${SITE_URL}/api/account/type`,
      { headers: { Cookie: cookieStore.toString() }, cache: "no-store" },
      8_000
    );
    if (!res.ok) return false;

    const text = await res.text().catch(() => "");
    const json = safeJsonParse(text);
    const ct = String(json?.customerType ?? "").toUpperCase();
    return ct === "AZIENDE" || ct === "BUSINESS";
  } catch {
    return false;
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

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

  const imagesFromImages = extractMediaUrls(base, a?.images);
  const imagesFromImage  = extractMediaUrls(base, a?.image);
  const imagesFromCover  = extractMediaUrls(base, a?.cover);
  const imagesFromThumb  = extractMediaUrls(base, a?.thumbnail);

  const images = imagesFromImages.length
    ? imagesFromImages
    : imagesFromImage.length
    ? imagesFromImage
    : imagesFromCover.length
    ? imagesFromCover
    : imagesFromThumb;

  const variantsData = a?.variants?.data ?? a?.variants ?? [];
  const variants = Array.isArray(variantsData)
    ? variantsData
        .map((v: any) => {
          const va = v?.attributes ?? v ?? {};
          const sku = va?.sku ?? null;
          return sku ? { sku: String(sku) } : null;
        })
        .filter(Boolean)
    : [];

  // priceAziende: normalizzato qui, filtrato server-side prima di passare al client
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

// ─── fetch categoria / subcategoria ───────────────────────────────────────────

async function fetchMacroLabel(macroSlug: string) {
  const qs = new URLSearchParams();
  qs.set("filters[slug][$eq]", macroSlug);
  qs.set("pagination[pageSize]", "1");
  qs.set("fields[0]", "label");
  qs.set("fields[1]", "slug");

  const r = await fetchStrapi(`/api/categories?${qs.toString()}`);
  const data: any[] = Array.isArray(r.json?.data) ? r.json.data : [];
  const row = data[0];
  const a = row?.attributes ?? row ?? {};
  return {
    slug: safeStr(a?.slug, macroSlug),
    label: safeStr(a?.label ?? a?.name ?? a?.title, macroSlug),
  };
}

async function fetchSubLabel(subSlug: string) {
  const qs = new URLSearchParams();
  qs.set("filters[slug][$eq]", subSlug);
  qs.set("pagination[pageSize]", "1");
  qs.set("fields[0]", "label");
  qs.set("fields[1]", "slug");

  const r = await fetchStrapi(`/api/subcategories?${qs.toString()}`);
  const data: any[] = Array.isArray(r.json?.data)
    ? r.json.data
    : Array.isArray(r.json)
    ? r.json
    : [];
  const row = data[0];
  const a = row?.attributes ?? row ?? {};
  return {
    slug: safeStr(a?.slug, subSlug),
    label: safeStr(a?.label ?? a?.name ?? a?.title, subSlug),
  };
}

// ─── fetch prodotti ───────────────────────────────────────────────────────────

async function fetchProductsBySub(macroSlug: string, subSlug: string) {
  const base = normalizedStrapiBaseUrl();

  const attempts: Array<{ label: string; qs: URLSearchParams }> = [
    (() => {
      const qs = new URLSearchParams();
      qs.set("pagination[pageSize]", String(PAGE_SIZE));
      qs.set("sort[0]", "createdAt:desc");
      qs.set("filters[subcategory][slug][$eq]", subSlug);
      qs.set("populate", "*");
      return { label: "subcategory.slug", qs };
    })(),
    (() => {
      const qs = new URLSearchParams();
      qs.set("pagination[pageSize]", String(PAGE_SIZE));
      qs.set("sort[0]", "createdAt:desc");
      qs.set("filters[subcategory][slug][$eq]", subSlug);
      qs.set("filters[subcategory][category][slug][$eq]", macroSlug);
      qs.set("populate", "*");
      return { label: "subcategory.slug+macroSlug", qs };
    })(),
    (() => {
      const qs = new URLSearchParams();
      qs.set("pagination[pageSize]", String(PAGE_SIZE));
      qs.set("sort[0]", "createdAt:desc");
      qs.set("filters[category][slug][$eq]", macroSlug);
      qs.set("populate", "*");
      return { label: "category.slug fallback", qs };
    })(),
  ];

  for (const attempt of attempts) {
    const r = await fetchStrapi(`/api/products?${attempt.qs.toString()}`);
    if (r.isValidation) continue;
    if (!r.ok) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[categoria/sub] attempt "${attempt.label}" failed:`, r.status);
      }
      return [];
    }
    const data: any[] = Array.isArray(r.json?.data) ? r.json.data : [];
    if (data.length === 0) continue;
    return data.map((row) => normalizeProduct(row, r.base || base));
  }

  return [];
}

async function safeGetAvailabilityOrNull(skus: string[]) {
  if (!skus.length) return null;
  try {
    const mod = await import("@/lib/inventory.server");
    if (!mod?.getAvailability) return null;
    return await mod.getAvailability({ skus, warehouse: "MAIN" });
  } catch (e: any) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[categoria/sub] availability skipped:", e?.message || e);
    }
    return null;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function MacroSubPage({
  params,
}: {
  params: Promise<{ macro: string; sub: string }>;
}) {
  const { macro, sub } = await params;

  const macroSlug = safeDecode(macro);
  const subSlug   = safeDecode(sub);

  if (!macroSlug || !subSlug) return notFound();

  // Esegui in parallelo: dati categoria + check business + prodotti
  const [macroObj, subObj, isBusiness, items] = await Promise.all([
    fetchMacroLabel(macroSlug).catch(() => ({ slug: macroSlug, label: macroSlug })),
    fetchSubLabel(subSlug).catch(() => ({ slug: subSlug, label: subSlug })),
    checkIsBusiness(),
    fetchProductsBySub(macroSlug, subSlug).catch(() => []),
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
      // priceAziende visibile SOLO se utente verificato BUSINESS
      priceAziende: isBusiness ? (it?.priceAziende ?? null) : null,
    };
  });

  const hasProducts = itemsWithStock.length > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Catalogo", href: "/catalogo" },
          { label: macroObj.label, href: `/categoria/${macroObj.slug}` },
          { label: subObj.label },
        ]}
      />

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">
            {macroObj.label} · {subObj.label}
          </h1>
          <p className="mt-1 text-sm text-text/70">
            Filtra e ordina i prodotti della sottocategoria.
          </p>
        </div>
        <Link href="/catalogo" className="text-sm font-semibold text-link hover:text-link-hover">
          Torna al catalogo
        </Link>
      </div>

      {!hasProducts ? (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm font-semibold">
            Nessun prodotto disponibile in questa sottocategoria.
          </p>
          <p className="mt-2 text-sm text-text/70">
            Prova un&apos;altra sottocategoria oppure torna al catalogo completo.
          </p>
          <Link
            href="/catalogo"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover"
          >
            Torna al catalogo
          </Link>
        </div>
      ) : (
        <ProductsGridWithFilters
          items={itemsWithStock as any}
          emptyText="Nessun prodotto trovato in questa sottocategoria."
        />
      )}
    </div>
  );
}
