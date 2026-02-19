import type { Product, TaxonomyRef, ProductVariant } from "@/lib/types";

type AnyObj = Record<string, unknown>;

export type NavSub = { slug: string; label: string };
export type MacroCategory = {
  slug: string;
  label: string;
  icon?: string | null;
  subcategories: NavSub[];
};

const STRAPI_URL =
  process.env.STRAPI_URL ||
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  "http://localhost:1337";

const STRAPI_TOKEN =
  process.env.STRAPI_API_TOKEN || process.env.NEXT_PUBLIC_STRAPI_API_TOKEN;

const BASE_URL = String(STRAPI_URL || "").replace(/\/+$/, "");

const DEFAULT_REVALIDATE = 60;

// ⚠️ in produzione Strapi spesso impone un max pageSize.
// lasciamo 200 come target, ma faremo retry più basso se Strapi rifiuta.
const MAX_PAGE_SIZE = 200;

const FETCH_TIMEOUT_MS = Number(process.env.CATALOG_STRAPI_TIMEOUT_MS ?? 6500);

// -------- utils
function isNonNull<T>(v: T | null | undefined): v is T {
  return v !== null && v !== undefined;
}

function publicHeaders(): HeadersInit {
  return { Accept: "application/json" };
}

function headersWithToken(): HeadersInit {
  const h: Record<string, string> = { Accept: "application/json" };
  if (STRAPI_TOKEN) h.Authorization = `Bearer ${STRAPI_TOKEN}`;
  return h;
}

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function absUrl(base: string, maybeUrl: string | null | undefined) {
  if (!maybeUrl) return null;
  const u = String(maybeUrl).trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${base.replace(/\/$/, "")}${u}`;
  return u;
}

function toNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function unwrapCollection(json: any): any[] {
  const data = json?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(json)) return json;
  return [];
}

function pickAttrs(row: any) {
  // Strapi 4: { id, attributes: {...} }
  // Strapi 5 (e/o custom response): spesso flat
  return row?.attributes ?? row ?? {};
}

function normalizeNavSub(s: any): NavSub | null {
  const a = pickAttrs(s);
  const slug = String(a?.slug ?? "").trim();
  if (!slug) return null;
  const label = String(a?.label ?? a?.name ?? a?.title ?? slug).trim() || slug;
  return { slug, label };
}

function normalizeCategory(row: any): MacroCategory | null {
  const a = pickAttrs(row);
  const slug = String(a?.slug ?? "").trim();
  if (!slug) return null;

  const label = String(a?.label ?? a?.name ?? a?.title ?? slug).trim() || slug;

  const iconRaw =
    a?.icon?.url ??
    a?.icon?.data?.attributes?.url ??
    a?.icon?.attributes?.url ??
    a?.iconUrl ??
    null;

  const icon = absUrl(BASE_URL, iconRaw) ?? iconRaw ?? null;

  const subsData = a?.subcategories?.data ?? a?.subcategories ?? [];
  const subsArr = Array.isArray(subsData) ? subsData : [];
  const subcategories: NavSub[] = subsArr
    .map((x: any) => normalizeNavSub(x))
    .filter((x: NavSub | null): x is NavSub => Boolean(x?.slug && x?.label));

  return { slug, label, icon, subcategories };
}

function extractMediaUrls(base: string, media: any): string[] {
  if (!media) return [];
  const data = media?.data ?? media;
  const arr = Array.isArray(data) ? data : [data];

  return arr
    .map((node: any) => {
      const a = pickAttrs(node);

      const u =
        a?.formats?.large?.url ??
        a?.formats?.medium?.url ??
        a?.formats?.small?.url ??
        a?.formats?.thumbnail?.url ??
        a?.url ??
        node?.formats?.large?.url ??
        node?.formats?.medium?.url ??
        node?.formats?.small?.url ??
        node?.formats?.thumbnail?.url ??
        node?.url ??
        null;

      return absUrl(base, u) || "";
    })
    .filter(Boolean);
}

function normalizeCategoryRef(x: any): TaxonomyRef | null {
  if (!x) return null;

  // già normalizzato
  if (typeof x?.slug === "string") {
    const slug = String(x.slug).trim();
    if (!slug) return null;
    const label = String(x?.label ?? x?.name ?? x?.title ?? slug).trim() || slug;
    return { slug, label };
  }

  const d = x?.data ?? x;
  const a = pickAttrs(d);
  const slug = String(a?.slug ?? "").trim();
  if (!slug) return null;
  const label = String(a?.label ?? a?.name ?? a?.title ?? slug).trim() || slug;
  return { slug, label };
}

function normalizeProduct(row: AnyObj): Product {
  const a = pickAttrs(row);

  const imagesFromImages = extractMediaUrls(BASE_URL, (a as any)?.images);
  const imagesFromImage = extractMediaUrls(BASE_URL, (a as any)?.image);
  const imagesFromCover = extractMediaUrls(BASE_URL, (a as any)?.cover);
  const imagesFromThumb = extractMediaUrls(BASE_URL, (a as any)?.thumbnail);

  const images =
    imagesFromImages.length
      ? imagesFromImages
      : imagesFromImage.length
        ? imagesFromImage
        : imagesFromCover.length
          ? imagesFromCover
          : imagesFromThumb;

  const variantsData = (a as any)?.variants?.data ?? (a as any)?.variants ?? [];
  const variants: ProductVariant[] = Array.isArray(variantsData)
    ? variantsData
        .map((v: any) => {
          const va = pickAttrs(v);
          const sku = (va as any)?.sku ?? (v as any)?.sku ?? null;
          return sku ? ({ sku } as ProductVariant) : null;
        })
        .filter(isNonNull)
    : [];

  let category = normalizeCategoryRef((a as any)?.category);
  const subcategory = normalizeCategoryRef((a as any)?.subcategory);

  if (!category) {
    const subRaw = (a as any)?.subcategory;
    const subAttrs = pickAttrs(subRaw?.data ?? subRaw);
    if (subAttrs?.category) category = normalizeCategoryRef(subAttrs.category);
  }

  const idRaw =
    (row as any)?.documentId ??
    (row as any)?.id ??
    (a as any)?.documentId ??
    (a as any)?.id ??
    (a as any)?.slug ??
    "";

  const id = String(idRaw);

  const legacyCat = String((a as any)?.categorySlug ?? (a as any)?.macroSlug ?? "").trim();
  const categorySlug = category?.slug ?? (legacyCat ? legacyCat : undefined);

  const legacySub = String((a as any)?.subSlug ?? "").trim();
  const subSlug = subcategory?.slug ?? (legacySub ? legacySub : undefined);

  return {
    id,
    documentId: (row as any)?.documentId ?? (a as any)?.documentId ?? null,
    slug: String((a as any)?.slug ?? "").trim(),
    name: (a as any)?.name ?? (a as any)?.title ?? "",
    price: toNumber((a as any)?.price) ?? 0,
    compareAtPrice: toNumber((a as any)?.compareAtPrice),
    shortDescription: (a as any)?.shortDescription ?? "",
    description: (a as any)?.description ?? null,
    specs: (a as any)?.specs ?? null,
    inStock: typeof (a as any)?.inStock === "boolean" ? (a as any).inStock : undefined,
    isNew: Boolean((a as any)?.isNew ?? false),

    category,
    subcategory,
    categorySlug,
    subSlug,

    images: images.length ? images : undefined,
    image: images[0] || undefined,

    variants: variants.length ? variants : undefined,

    seoTitle: (a as any)?.seoTitle ?? null,
    seoDescription: (a as any)?.seoDescription ?? null,
    seoImage: extractMediaUrls(BASE_URL, (a as any)?.seoImage)?.[0] ?? null,

    // ✅ stock fields (Strapi flat)
    stockQty: typeof (a as any)?.stockQty === "number" ? (a as any).stockQty : null,
    trackInventory:
      typeof (a as any)?.trackInventory === "boolean" ? (a as any).trackInventory : null,
    aziendaDiscountEligible:
      typeof (a as any)?.aziendaDiscountEligible === "boolean"
        ? (a as any).aziendaDiscountEligible
        : undefined,
    priceAziende: toNumber((a as any)?.priceAziende),
  } as any;
}

// -------- fetch helpers (robusti)
async function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const controller = new AbortController();
  const { timeoutMs, ...rest } = init;

  const t = setTimeout(() => controller.abort(), timeoutMs ?? FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

function isValidationErrorPayload(json: any) {
  return json?.error?.name === "ValidationError";
}

function buildProductsPopulate(qs: URLSearchParams) {
  qs.set("populate[images][fields][0]", "url");
  qs.set("populate[images][fields][1]", "formats");
  qs.set("populate[image][fields][0]", "url");
  qs.set("populate[image][fields][1]", "formats");
  qs.set("populate[cover][fields][0]", "url");
  qs.set("populate[cover][fields][1]", "formats");
  qs.set("populate[thumbnail][fields][0]", "url");
  qs.set("populate[thumbnail][fields][1]", "formats");
  qs.set("populate[seoImage][fields][0]", "url");
  qs.set("populate[seoImage][fields][1]", "formats");

  qs.set("populate[variants][fields][0]", "sku");

  qs.set("populate[category][fields][0]", "slug");
  qs.set("populate[category][fields][1]", "label");

  qs.set("populate[subcategory][fields][0]", "slug");
  qs.set("populate[subcategory][fields][1]", "label");
  qs.set("populate[subcategory][populate][category][fields][0]", "slug");
  qs.set("populate[subcategory][populate][category][fields][1]", "label");

  qs.set("populate[categories][fields][0]", "slug");
  qs.set("populate[categories][fields][1]", "label");

  qs.set("populate[subcategories][fields][0]", "slug");
  qs.set("populate[subcategories][fields][1]", "label");
  qs.set("populate[subcategories][populate][category][fields][0]", "slug");
  qs.set("populate[subcategories][populate][category][fields][1]", "label");
}

async function fetchStrapi(
  path: string,
  qs?: URLSearchParams,
  revalidate = DEFAULT_REVALIDATE,
  opts?: { auth?: boolean }
): Promise<{ ok: boolean; status: number; json: any; text: string }> {
  const url = `${BASE_URL}${path}${qs ? `?${qs.toString()}` : ""}`;

  try {
    const res = await fetchWithTimeout(url, {
      next: { revalidate },
      headers: opts?.auth ? headersWithToken() : publicHeaders(),
    });

    const text = await res.text().catch(() => "");
    const json = safeJsonParse(text);
    return { ok: res.ok, status: res.status, json, text };
  } catch (e: any) {
    const isAbort = e?.name === "AbortError";
    return {
      ok: false,
      status: isAbort ? 504 : 0,
      json: null,
      text: isAbort ? "Timeout" : "Fetch failed",
    };
  }
}

/**
 * ✅ Helper: recupera 1 singolo prodotto via filters (evita di scaricare tutto il catalogo)
 */
async function fetchFirstProductByFilter(
  buildFilters: (qs: URLSearchParams) => void,
  revalidate = 10
): Promise<Product | null> {
  const qs = new URLSearchParams();
  buildProductsPopulate(qs);
  buildFilters(qs);
  qs.set("pagination[pageSize]", "1");
  qs.set("sort[0]", "createdAt:desc");

  const res = await fetchStrapi("/api/products", qs, revalidate);
  if (!res.ok) return null;

  const rows = unwrapCollection(res.json);
  const first = rows?.[0];
  if (!first) return null;

  return normalizeProduct(first);
}

async function fetchCategoriesAll(): Promise<MacroCategory[]> {
  const qs = new URLSearchParams();
  qs.set("populate", "*");
  qs.set("pagination[pageSize]", String(MAX_PAGE_SIZE));
  qs.set("sort[0]", "createdAt:asc");

  const { ok, json } = await fetchStrapi("/api/categories", qs, 60);
  if (!ok) return [];

  return unwrapCollection(json)
    .map((row: any) => normalizeCategory(row))
    .filter((x: MacroCategory | null): x is MacroCategory => Boolean(x?.slug));
}

async function fetchSubcategoriesAll(): Promise<NavSub[]> {
  const qs = new URLSearchParams();
  qs.set("populate", "*");
  qs.set("pagination[pageSize]", String(MAX_PAGE_SIZE));
  qs.set("sort[0]", "createdAt:asc");

  const { ok, json } = await fetchStrapi("/api/subcategories", qs, 60);
  if (!ok) return [];

  return unwrapCollection(json)
    .map((row: any) => normalizeNavSub(row))
    .filter((x: NavSub | null): x is NavSub => Boolean(x?.slug));
}

async function fetchProductsAll(): Promise<Product[]> {
  // ✅ retry su pageSize più basso se Strapi rifiuta il 200
  const pageSizes = [MAX_PAGE_SIZE, 100, 50];

  for (const size of pageSizes) {
    const qs = new URLSearchParams();
    buildProductsPopulate(qs);
    qs.set("pagination[pageSize]", String(size));
    qs.set("sort[0]", "createdAt:desc");

    const res = await fetchStrapi("/api/products", qs, 30);

    if (res.ok) {
      return unwrapCollection(res.json)
        .map((row: any) => normalizeProduct(row))
        .filter((p: Product | null): p is Product => Boolean(p?.slug));
    }

    if (res.status === 400 && isValidationErrorPayload(res.json)) continue;

    return [];
  }

  return [];
}

async function fetchProductsByMacroSlug(macroSlug: string): Promise<Product[]> {
  const slug = String(macroSlug ?? "").trim();
  if (!slug) return [];

  const pageSizes = [MAX_PAGE_SIZE, 100, 50];

  const attempts: Array<() => URLSearchParams> = [
    () => {
      const qs = new URLSearchParams();
      buildProductsPopulate(qs);
      qs.set("filters[subcategory][category][slug][$eq]", slug);
      qs.set("sort[0]", "createdAt:desc");
      return qs;
    },
    () => {
      const qs = new URLSearchParams();
      buildProductsPopulate(qs);
      qs.set("filters[subcategories][category][slug][$eq]", slug);
      qs.set("sort[0]", "createdAt:desc");
      return qs;
    },
    () => {
      const qs = new URLSearchParams();
      buildProductsPopulate(qs);
      qs.set("filters[category][slug][$eq]", slug);
      qs.set("sort[0]", "createdAt:desc");
      return qs;
    },
    () => {
      const qs = new URLSearchParams();
      buildProductsPopulate(qs);
      qs.set("filters[categories][slug][$eq]", slug);
      qs.set("sort[0]", "createdAt:desc");
      return qs;
    },
    () => {
      const qs = new URLSearchParams();
      buildProductsPopulate(qs);
      qs.set("filters[categorySlug][$eq]", slug);
      qs.set("sort[0]", "createdAt:desc");
      return qs;
    },
    () => {
      const qs = new URLSearchParams();
      buildProductsPopulate(qs);
      qs.set("filters[macroSlug][$eq]", slug);
      qs.set("sort[0]", "createdAt:desc");
      return qs;
    },
  ];

  for (const makeQs of attempts) {
    for (const size of pageSizes) {
      const qs = makeQs();
      qs.set("pagination[pageSize]", String(size));

      const res = await fetchStrapi("/api/products", qs, 10);

      if (res.ok) {
        return unwrapCollection(res.json)
          .map((row: any) => normalizeProduct(row))
          .filter((p: Product | null): p is Product => Boolean(p?.slug));
      }

      if (res.status === 400 && isValidationErrorPayload(res.json)) {
        // prova size più basso
        continue;
      }

      return [];
    }
  }

  return [];
}

async function fetchProductsByMacroAndSubSlug(
  macroSlug: string,
  subSlug: string
): Promise<Product[]> {
  const cat = String(macroSlug ?? "").trim();
  const sub = String(subSlug ?? "").trim();
  if (!cat || !sub) return [];

  const pageSizes = [MAX_PAGE_SIZE, 100, 50];

  const attempts: Array<() => URLSearchParams> = [
    () => {
      const qs = new URLSearchParams();
      buildProductsPopulate(qs);
      qs.set("filters[subcategory][slug][$eq]", sub);
      qs.set("filters[subcategory][category][slug][$eq]", cat);
      qs.set("sort[0]", "createdAt:desc");
      return qs;
    },
    () => {
      const qs = new URLSearchParams();
      buildProductsPopulate(qs);
      qs.set("filters[subcategories][slug][$eq]", sub);
      qs.set("filters[subcategories][category][slug][$eq]", cat);
      qs.set("sort[0]", "createdAt:desc");
      return qs;
    },
    () => {
      const qs = new URLSearchParams();
      buildProductsPopulate(qs);
      qs.set("filters[category][slug][$eq]", cat);
      qs.set("filters[subcategory][slug][$eq]", sub);
      qs.set("sort[0]", "createdAt:desc");
      return qs;
    },
    () => {
      const qs = new URLSearchParams();
      buildProductsPopulate(qs);
      qs.set("filters[categories][slug][$eq]", cat);
      qs.set("filters[subcategories][slug][$eq]", sub);
      qs.set("sort[0]", "createdAt:desc");
      return qs;
    },
    () => {
      const qs = new URLSearchParams();
      buildProductsPopulate(qs);
      qs.set("filters[categorySlug][$eq]", cat);
      qs.set("filters[subSlug][$eq]", sub);
      qs.set("sort[0]", "createdAt:desc");
      return qs;
    },
  ];

  for (const makeQs of attempts) {
    for (const size of pageSizes) {
      const qs = makeQs();
      qs.set("pagination[pageSize]", String(size));

      const res = await fetchStrapi("/api/products", qs, 10);

      if (res.ok) {
        return unwrapCollection(res.json)
          .map((row: any) => normalizeProduct(row))
          .filter((p: Product | null): p is Product => Boolean(p?.slug));
      }

      if (res.status === 400 && isValidationErrorPayload(res.json)) {
        // prova size più basso
        continue;
      }

      return [];
    }
  }

  return [];
}

// -------- exports
export async function getMacroBySlug(macroSlug: string): Promise<MacroCategory | null> {
  const slug = String(macroSlug ?? "").trim();
  if (!slug) return null;

  const cats = await fetchCategoriesAll();
  const found = cats.find((c) => c.slug === slug);
  if (found) return found;

  // fallback (ultimo tentativo)
  const products = await fetchProductsAll();
  const p = products.find((x) => x?.category?.slug === slug);
  if (p) {
    return {
      slug,
      label: String(p.category?.label ?? titleFromSlug(slug)),
      icon: null,
      subcategories: [],
    };
  }

  return null;
}

export async function getSubBySlug(macroSlug: string, subSlug: string): Promise<NavSub | null> {
  const cat = String(macroSlug ?? "").trim();
  const sub = String(subSlug ?? "").trim();
  if (!cat || !sub) return null;

  const macro = await getMacroBySlug(cat);
  const fromMacro = macro?.subcategories?.find((s) => s.slug === sub);
  if (fromMacro) return fromMacro;

  const subs = await fetchSubcategoriesAll();
  const direct = subs.find((s) => s.slug === sub);
  if (direct) return direct;

  const products = await fetchProductsByMacroAndSubSlug(cat, sub);
  if (products.length) return { slug: sub, label: titleFromSlug(sub) };

  return null;
}

export async function getAllProducts(): Promise<Product[]> {
  return fetchProductsAll();
}

/**
 * ✅ FIX: query diretta su Strapi (non più fetch di tutto il catalogo)
 */
export async function getProductBySlug(slugInput: string): Promise<Product | null> {
  const slug = String(slugInput ?? "").trim();
  if (!slug) return null;

  return fetchFirstProductByFilter((qs) => {
    qs.set("filters[slug][$eq]", slug);
  }, 10);
}

/**
 * ✅ FIX: supporto documentId (Strapi 5) + fallback id numerico + fallback slug
 */
export async function getProductById(idInput: string): Promise<Product | null> {
  const id = String(idInput ?? "").trim();
  if (!id) return null;

  // 1) prova documentId (Strapi 5)
  const byDocId = await fetchFirstProductByFilter((qs) => {
    qs.set("filters[documentId][$eq]", id);
  }, 10);

  if (byDocId) return byDocId;

  // 2) prova id numerico
  const maybeNum = Number(id);
  if (Number.isFinite(maybeNum)) {
    const byId = await fetchFirstProductByFilter((qs) => {
      qs.set("filters[id][$eq]", String(maybeNum));
    }, 10);
    if (byId) return byId;
  }

  // 3) fallback: se arriva uno slug per errore
  return getProductBySlug(id);
}

export async function getProductsByMacro(macroSlug: string): Promise<Product[]> {
  return fetchProductsByMacroSlug(macroSlug);
}

export async function getProductsByMacroAndSub(
  macroSlug: string,
  subSlug: string
): Promise<Product[]> {
  return fetchProductsByMacroAndSubSlug(macroSlug, subSlug);
}

export async function getRelatedProducts(product: Product, limit = 8): Promise<Product[]> {
  const catSlug = String(product?.category?.slug ?? "").trim();
  const mySlug = String(product?.slug ?? "").trim();
  if (!catSlug) return [];

  const take = Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 8);
  const products = await fetchProductsByMacroSlug(catSlug);

  return products.filter((p) => String(p?.slug ?? "") !== mySlug).slice(0, take);
}
