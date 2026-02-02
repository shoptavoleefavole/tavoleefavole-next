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

const BASE_URL = STRAPI_URL.replace(/\/+$/, "");

const DEFAULT_REVALIDATE = 60;
const MAX_PAGE_SIZE = 200;

// -------- utils

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

/** Supporta Strapi v4 “{data:[{attributes}]}” e API custom che restituisce direttamente array */
function unwrapCollection(json: any): any[] {
  const data = json?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(json)) return json;
  return [];
}

function pickAttrs(row: any) {
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
        a?.url ??
        a?.formats?.large?.url ??
        a?.formats?.medium?.url ??
        a?.formats?.small?.url ??
        a?.formats?.thumbnail?.url ??
        node?.url ??
        node?.formats?.large?.url ??
        node?.formats?.medium?.url ??
        node?.formats?.small?.url ??
        node?.formats?.thumbnail?.url ??
        null;

      return absUrl(base, u) || "";
    })
    .filter(Boolean);
}

function normalizeCategoryRef(x: any): TaxonomyRef | null {
  if (!x) return null;

  // v5 flat relation object
  if (typeof x?.slug === "string") {
    const slug = String(x.slug).trim();
    if (!slug) return null;
    const label = String(x?.label ?? x?.name ?? x?.title ?? slug).trim() || slug;
    return { slug, label };
  }

  // v4 relation {data:{attributes}}
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
    ? variantsData.map((v: any) => ({
        sku: (pickAttrs(v) as any)?.sku ?? v?.sku ?? null,
      }))
    : [];

  const category = normalizeCategoryRef((a as any)?.category);
  const subcategory = normalizeCategoryRef((a as any)?.subcategory);

  const idRaw =
    (row as any)?.documentId ??
    (row as any)?.id ??
    (a as any)?.documentId ??
    (a as any)?.id ??
    (a as any)?.slug ??
    "";

  const id = String(idRaw);

  // legacy fields (se servono a componenti vecchi)
  const legacyCat = String(
    (a as any)?.categorySlug ?? (a as any)?.macroSlug ?? ""
  ).trim();
  const categorySlug = category?.slug ?? (legacyCat ? legacyCat : undefined);

  const legacySub = String((a as any)?.subSlug ?? "").trim();
  const subSlug = subcategory?.slug ?? (legacySub ? legacySub : undefined);
  const inStockRaw = (a as any)?.inStock;
  const inStock = typeof inStockRaw === "boolean" ? inStockRaw : true;

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

    // taxonomy
    category,
    subcategory,
    categorySlug,
    subSlug,

    // media
    images: images.length ? images : undefined,
    image: images[0] || undefined,

    // variants
    variants: variants.length ? variants : undefined,

    // SEO (se presenti)
    seoTitle: (a as any)?.seoTitle ?? null,
    seoDescription: (a as any)?.seoDescription ?? null,
    seoImage: extractMediaUrls(BASE_URL, (a as any)?.seoImage)?.[0] ?? null,
  };
}

// -------- fetch helpers

async function fetchStrapi(
  path: string,
  qs?: URLSearchParams,
  revalidate = DEFAULT_REVALIDATE
): Promise<{ ok: boolean; status: number; json: any }> {
  const url = `${BASE_URL}${path}${qs ? `?${qs.toString()}` : ""}`;

  try {
    const res = await fetch(url, { next: { revalidate }, headers: headersWithToken() });
    const text = await res.text().catch(() => "");
    const json = safeJsonParse(text);
    return { ok: res.ok, status: res.status, json };
  } catch {
    return { ok: false, status: 0, json: null };
  }
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

async function fetchProductsAll(): Promise<Product[]> {
  const qs = new URLSearchParams();
  qs.set("populate", "*");
  qs.set("pagination[pageSize]", String(MAX_PAGE_SIZE));
  qs.set("sort[0]", "createdAt:desc");

  const { ok, json } = await fetchStrapi("/api/products", qs, 30);
  if (!ok) return [];

  return unwrapCollection(json)
    .map((row: any) => normalizeProduct(row))
    .filter((p: Product | null): p is Product => Boolean(p?.slug));
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

// -------- exports (API)

export async function getMacroBySlug(macroSlug: string): Promise<MacroCategory | null> {
  const slug = String(macroSlug ?? "").trim();
  if (!slug) return null;

  // 1) categorie
  const cats = await fetchCategoriesAll();
  const found = cats.find((c) => c.slug === slug);
  if (found) return found;

  // 2) fallback: deriva dai prodotti
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

  // 1) prova dalla macro (se ha subcategories popolato)
  const macro = await getMacroBySlug(cat);
  const fromMacro = macro?.subcategories?.find((s) => s.slug === sub);
  if (fromMacro) return fromMacro;

  // 2) prova endpoint /api/subcategories (se esiste)
  const subs = await fetchSubcategoriesAll();
  const direct = subs.find((s) => s.slug === sub);
  if (direct) return direct;

  // 3) fallback: deriva dai prodotti
  const products = await fetchProductsAll();
  const existsViaProducts = products.some(
    (p) => p?.category?.slug === cat && p?.subcategory?.slug === sub
  );

  if (existsViaProducts) {
    return { slug: sub, label: titleFromSlug(sub) };
  }

  return null;
}

export async function getAllProducts(): Promise<Product[]> {
  return fetchProductsAll();
}

export async function getProductBySlug(slugInput: string): Promise<Product | null> {
  const slug = String(slugInput ?? "").trim();
  if (!slug) return null;

  const products = await fetchProductsAll();
  return products.find((p) => p?.slug === slug) ?? null;
}

export async function getProductById(idInput: string): Promise<Product | null> {
  const id = String(idInput ?? "").trim();
  if (!id) return null;

  const products = await fetchProductsAll();

  return (
    products.find((p) => String(p?.documentId ?? p?.id) === id) ??
    products.find((p) => p?.slug === id) ??
    null
  );
}

export async function getProductsByMacro(macroSlug: string): Promise<Product[]> {
  const slug = String(macroSlug ?? "").trim();
  if (!slug) return [];

  const products = await fetchProductsAll();
  return products.filter((p) => p?.category?.slug === slug);
}

export async function getProductsByMacroAndSub(
  macroSlug: string,
  subSlug: string
): Promise<Product[]> {
  const cat = String(macroSlug ?? "").trim();
  const sub = String(subSlug ?? "").trim();
  if (!cat || !sub) return [];

  const products = await fetchProductsAll();
  return products.filter((p) => p?.category?.slug === cat && p?.subcategory?.slug === sub);
}

export async function getRelatedProducts(product: Product, limit = 8): Promise<Product[]> {
  const catSlug = String(product?.category?.slug ?? "").trim();
  const mySlug = String(product?.slug ?? "").trim();
  if (!catSlug) return [];

  const take = Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 8);

  const products = await fetchProductsAll();
  return products
    .filter((p) => p?.category?.slug === catSlug && String(p?.slug ?? "") !== mySlug)
    .slice(0, take);
}
