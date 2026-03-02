// src/app/categoria/[macro]/[sub]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";

import ProductsGridWithFilters from "@/components/catalog/ProductsGridWithFilters";
import Breadcrumbs from "@/components/Breadcrumbs";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// ✅ SECURITY: mai usare NEXT_PUBLIC_ per token server-side (vengono bundlati lato client)
const STRAPI_URL =
  process.env.STRAPI_URL ||
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  "http://localhost:1337";

const STRAPI_TOKEN =
  process.env.STRAPI_API_TOKEN ||
  process.env.STRAPI_TOKEN ||
  "";

const FETCH_TIMEOUT_MS = (() => {
  const n = Number(process.env.CATEGORY_STRAPI_TIMEOUT_MS ?? 25000);
  return Number.isFinite(n) ? Math.max(8000, n) : 25000;
})();

const PAGE_SIZE = 200;

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

    const isValidation =
      res.status === 400 && json?.error?.name === "ValidationError";

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
  const imagesFromImage = extractMediaUrls(base, a?.image);
  const imagesFromCover = extractMediaUrls(base, a?.cover);
  const imagesFromThumb = extractMediaUrls(base, a?.thumbnail);

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

  return {
    id: String(id),
    documentId: row?.documentId ?? a?.documentId ?? null,
    slug,
    name: safeStr(a?.name ?? a?.title, "Prodotto"),
    price: typeof a?.price === "number" ? a.price : Number(a?.price ?? 0),
    compareAtPrice: a?.compareAtPrice ?? null,
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

async function fetchProductsBySub(macroSlug: string, subSlug: string) {
  const base = normalizedStrapiBaseUrl();

  // ✅ FIX: definisco tutti i tentativi come array e itero
  // Non esco mai su data: [] — continuo al tentativo successivo
  const attempts: Array<{ label: string; qs: URLSearchParams }> = [
    // 1️⃣ Filtro per subcategory.slug (caso più comune)
    (() => {
      const qs = new URLSearchParams();
      qs.set("pagination[pageSize]", String(PAGE_SIZE));
      qs.set("sort[0]", "createdAt:desc");
      qs.set("filters[subcategory][slug][$eq]", subSlug);
      qs.set("populate", "*");
      return { label: "subcategory.slug", qs };
    })(),

    // 2️⃣ Filtro per subcategory.slug + verifica macro (più preciso)
    (() => {
      const qs = new URLSearchParams();
      qs.set("pagination[pageSize]", String(PAGE_SIZE));
      qs.set("sort[0]", "createdAt:desc");
      qs.set("filters[subcategory][slug][$eq]", subSlug);
      qs.set("filters[subcategory][category][slug][$eq]", macroSlug);
      qs.set("populate", "*");
      return { label: "subcategory.slug+macroSlug", qs };
    })(),

    // 3️⃣ Fallback: filtro diretto su category.slug
    // (prodotti collegati direttamente alla macro, senza sottocategoria)
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

    // ValidationError → campo non esiste, salta questo tentativo
    if (r.isValidation) continue;

    // Errore reale (timeout/500/403) → interrompi e ritorna vuoto
    if (!r.ok) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[categoria/sub] attempt "${attempt.label}" failed:`, r.status);
      }
      return [];
    }

    const data: any[] = Array.isArray(r.json?.data) ? r.json.data : [];

    // ✅ FIX CHIAVE: 0 risultati → non ritornare, prova il prossimo tentativo
    if (data.length === 0) continue;

    // ✅ Trovati prodotti: normalizza e ritorna
    return data.map((row) => normalizeProduct(row, r.base || base));
  }

  // Nessun tentativo ha trovato prodotti
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

export default async function MacroSubPage({
  params,
}: {
  params: Promise<{ macro: string; sub: string }>;
}) {
  const { macro, sub } = await params;

  const macroSlug = safeDecode(macro);
  const subSlug = safeDecode(sub);

  if (!macroSlug || !subSlug) return notFound();

  const [macroObj, subObj] = await Promise.all([
    fetchMacroLabel(macroSlug).catch(() => ({ slug: macroSlug, label: macroSlug })),
    fetchSubLabel(subSlug).catch(() => ({ slug: subSlug, label: subSlug })),
  ]);

  const items = await fetchProductsBySub(macroSlug, subSlug).catch(() => []);

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