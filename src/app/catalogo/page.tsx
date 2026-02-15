import Link from "next/link";
import { notFound } from "next/navigation";

import ProductsGridWithFilters from "@/components/catalog/ProductsGridWithFilters";
import Breadcrumbs from "@/components/Breadcrumbs";
import { getAvailability } from "@/lib/inventory.server";

export const metadata = {
  title: "Catalogo",
};

type CatalogoSearchParams = {
  categoria?: string;
  q?: string;
  page?: string;
};

const PAGE_SIZE = 24;

const STRAPI_URL = (process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337").replace(/\/+$/, "");

const STRAPI_TOKEN =
  process.env.STRAPI_API_TOKEN || 
  process.env.STRAPI_TOKEN;
  "";

function toInt(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

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

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (STRAPI_TOKEN) headers.Authorization = `Bearer ${STRAPI_TOKEN}`;
  return headers;
}

function getDefaultSku(item: any): string | null {
  return item?.variants?.[0]?.sku ?? item?.variant?.sku ?? null;
}

function normalizeStrapiProduct(row: any) {
  const a = row?.attributes ?? row ?? {};

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

  const imagesData =
    a?.images?.data ??
    a?.images ??
    a?.image?.data ??
    a?.image ??
    a?.cover?.data ??
    a?.cover ??
    a?.thumbnail?.data ??
    a?.thumbnail ??
    null;

  const firstImage = Array.isArray(imagesData) ? imagesData[0] : imagesData;

  const imageUrlRaw =
    firstImage?.attributes?.url ??
    firstImage?.url ??
    a?.imageUrl ??
    a?.image ??
    null;

  const imageUrl = absUrl(STRAPI_URL, imageUrlRaw);

  // tenta di ricavare lo slug categoria in diversi modi
  const categorySlug =
    a?.category?.data?.attributes?.slug ??
    a?.category?.slug ??
    a?.categories?.[0]?.slug ??
    a?.categoria?.data?.attributes?.slug ??
    a?.categoria?.slug ??
    a?.categorySlug ??
    a?.macroSlug ??
    a?.macroAreaSlug ??
    null;

  return {
    id: row?.documentId ?? row?.id ?? a?.documentId ?? a?.id ?? null,
    documentId: row?.documentId ?? a?.documentId ?? null,
    name: a?.name ?? a?.title ?? "",
    slug: a?.slug ?? "",
    price: a?.price ?? null,
    compareAtPrice: a?.compareAtPrice ?? null,
    shortDescription: a?.shortDescription ?? "",
    inStock: a?.inStock ?? undefined,
    variants,
    image: imageUrl,
    imageUrl,
    categorySlug,
    __raw: a,
  };
}

async function fetchCategoryBySlug(slug: string) {
  const qs = new URLSearchParams();
  qs.set("filters[slug][$eq]", slug);
  qs.set("pagination[pageSize]", "1");
  qs.set("populate", "*");

  const url = `${STRAPI_URL.replace(/\/$/, "")}/api/categories?${qs.toString()}`;

  const res = await fetch(url, { next: { revalidate: 30 }, headers: getHeaders() });
  if (!res.ok) return null;

  const text = await res.text().catch(() => "");
  const json = safeJsonParse(text);
  const data: any[] = Array.isArray(json?.data) ? json.data : [];
  if (!data.length) return null;

  const a = data[0]?.attributes ?? data[0] ?? {};
  return {
    id: data[0]?.id ?? null,
    documentId: data[0]?.documentId ?? null,
    slug: a?.slug ?? slug,
    // ✅ nel tuo Strapi è "label"
    label: a?.label ?? a?.name ?? a?.title ?? slug,
  };
}

/**
 * Build query string per products.
 * categoryMode:
 * - "rel": filtra relazione -> filters[<key>][slug][$eq]
 * - "scalar": filtra campo testo -> filters[<key>][$eq]
 */
function buildProductsQS(params: {
  categoria?: string;
  q?: string;
  page: number;
  pageSize: number;
  categoryFilterKey?: string;
  categoryMode?: "rel" | "scalar";
}) {
  const qs = new URLSearchParams();
  qs.set("populate", "*");
  qs.set("sort[0]", "createdAt:desc");
  qs.set("pagination[page]", String(params.page));
  qs.set("pagination[pageSize]", String(params.pageSize));

  if (params.categoria && params.categoryFilterKey) {
    const key = params.categoryFilterKey;
    if (params.categoryMode === "scalar") {
      qs.set(`filters[${key}][$eq]`, params.categoria);
    } else {
      qs.set(`filters[${key}][slug][$eq]`, params.categoria);
    }
  }

  if (params.q) {
    qs.set("filters[$or][0][name][$containsi]", params.q);
    qs.set("filters[$or][1][shortDescription][$containsi]", params.q);
    qs.set("filters[$or][2][slug][$containsi]", params.q);
  }

  return qs;
}

async function fetchProductsOnce(params: {
  categoria?: string;
  q?: string;
  page: number;
  pageSize: number;
  categoryFilterKey?: string;
  categoryMode?: "rel" | "scalar";
}) {
  const qs = buildProductsQS(params);

  const url = `${STRAPI_URL.replace(/\/$/, "")}/api/products?${qs.toString()}`;
  const res = await fetch(url, { next: { revalidate: 30 }, headers: getHeaders() });

  const text = await res.text().catch(() => "");
  const json = safeJsonParse(text);

  if (!res.ok) {
    // se è ValidationError (400) proviamo fallback chiavi
    const isValidation = res.status === 400 && json?.error?.name === "ValidationError";
    const details = json?.error?.details ?? null;
    return { ok: false as const, status: res.status, text, json, isValidation, details, url };
  }

  const data: any[] = Array.isArray(json?.data) ? json.data : [];
  const meta = json?.meta?.pagination ?? null;

  return {
    ok: true as const,
    items: data.map(normalizeStrapiProduct),
    pagination: {
      page: Number(meta?.page ?? params.page),
      pageSize: Number(meta?.pageSize ?? params.pageSize),
      pageCount: Number(meta?.pageCount ?? 1),
      total: Number(meta?.total ?? data.length),
    },
  };
}

/**
 * Fetch prodotti con fallback robusto per filtro categoria.
 * Evita i 400 "Invalid key ..." provando più chiavi possibili.
 */
async function fetchProductsFromStrapi(params: {
  categoria?: string;
  q?: string;
  page: number;
  pageSize: number;
}) {
  // se non c’è categoria, una sola chiamata basta
  if (!params.categoria) {
    const r = await fetchProductsOnce({ ...params });
    if (r.ok) return r;
    // non buttare giù la pagina
    return {
      ok: true as const,
      items: [],
      pagination: { page: params.page, pageSize: params.pageSize, pageCount: 1, total: 0 },
    };
  }

  // ordine tentativi: relazione "category" (più probabile), poi altre
  const attempts: Array<{ key: string; mode: "rel" | "scalar" }> = [
    { key: "category", mode: "rel" },
    { key: "categories", mode: "rel" },
    { key: "categoria", mode: "rel" },
    { key: "macro", mode: "rel" },
    { key: "categorySlug", mode: "scalar" },
    { key: "macroSlug", mode: "scalar" },
  ];

  let lastValidation: any = null;

  for (const a of attempts) {
    const r = await fetchProductsOnce({
      ...params,
      categoryFilterKey: a.key,
      categoryMode: a.mode,
    });

    if (r.ok) return r;

    // se non è validation error, non ha senso continuare
    if (!r.isValidation) {
      return {
        ok: true as const,
        items: [],
        pagination: { page: params.page, pageSize: params.pageSize, pageCount: 1, total: 0 },
      };
    }

    lastValidation = r;
  }

  // tutti i tentativi falliti (validation): ritorna vuoto ma non 500
  // (utile per andare online mentre sistemi content type)
  void lastValidation;
  return {
    ok: true as const,
    items: [],
    pagination: { page: params.page, pageSize: params.pageSize, pageCount: 1, total: 0 },
  };
}

function buildCatalogHref(params: { categoria?: string; q?: string; page?: number }) {
  const sp = new URLSearchParams();
  if (params.categoria) sp.set("categoria", params.categoria);
  if (params.q) sp.set("q", params.q);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/catalogo?${qs}` : "/catalogo";
}

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams?: Promise<CatalogoSearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const categoria = (sp.categoria ?? "").trim();
  const q = (sp.q ?? "").trim();
  const pageRequested = toInt(sp.page, 1);

  const macro = categoria ? await fetchCategoryBySlug(categoria) : null;
  if (categoria && !macro) return notFound();

  // 1) fetch con page richiesta
  const res = await fetchProductsFromStrapi({
    categoria,
    q,
    page: pageRequested,
    pageSize: PAGE_SIZE,
  });

  let items = res.items;
  let pagination = res.pagination;

  // 2) se pageRequested è fuori range, refetch una sola volta sulla page valida
  const totalPages = Math.max(1, Number(pagination.pageCount ?? 1));
  const safePage = Math.min(Math.max(pageRequested, 1), totalPages);

  if (safePage !== pageRequested) {
    const res2 = await fetchProductsFromStrapi({
      categoria,
      q,
      page: safePage,
      pageSize: PAGE_SIZE,
    });
    items = res2.items;
    pagination = res2.pagination;
  }

  // Availability (non deve mai rompere)
  const skus: string[] = Array.from(
    new Set(
      items
        .map((p: any) => getDefaultSku(p))
        .filter((x: unknown): x is string => typeof x === "string" && x.length > 0)
    )
  );

  let bySku: any = {};
  try {
    const availability = skus.length ? await getAvailability({ skus, warehouse: "MAIN" }) : null;
    bySku = (availability as any)?.data?.MAIN ?? {};
  } catch {
    bySku = {};
  }

  const itemsWithStock = items.map((p: any) => {
    const sku = getDefaultSku(p);
    const row = sku ? bySku?.[sku] ?? null : null;
    const available = Number(row?.available ?? 0);

    return {
      ...p,
      inStock: sku ? available > 0 : p?.inStock,
      inventory: row,
      sku,
    };
  });

  const total = Number(pagination.total ?? 0);
  const pageCount = Math.max(1, Number(pagination.pageCount ?? 1));

  const prevPage = safePage > 1 ? safePage - 1 : null;
  const nextPage = safePage < pageCount ? safePage + 1 : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: macro ? `Catalogo · ${macro.label}` : "Catalogo" },
        ]}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">
            {macro ? `Catalogo · ${macro.label}` : "Catalogo"}
          </h1>
          <p className="mt-1 text-sm text-text/70">
            {total} prodotti{macro ? " nella macroarea selezionata" : ""}.
            {q ? ` Ricerca: “${q}”.` : ""}
          </p>
        </div>

        {macro ? (
          <Link
            href={buildCatalogHref({ q, page: 1 })}
            className="text-sm font-semibold text-link hover:text-link-hover"
          >
            Rimuovi filtro categoria
          </Link>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-sm text-text/70">
          Pagina {safePage} di {pageCount}
        </div>

        <div className="flex items-center gap-2">
          {prevPage ? (
            <Link
              href={buildCatalogHref({ categoria, q, page: prevPage })}
              className="rounded-md border px-3 py-1 text-sm hover:bg-black/5"
            >
              ← Prev
            </Link>
          ) : (
            <span className="rounded-md border px-3 py-1 text-sm text-text/40">← Prev</span>
          )}

          {nextPage ? (
            <Link
              href={buildCatalogHref({ categoria, q, page: nextPage })}
              className="rounded-md border px-3 py-1 text-sm hover:bg-black/5"
            >
              Next →
            </Link>
          ) : (
            <span className="rounded-md border px-3 py-1 text-sm text-text/40">Next →</span>
          )}
        </div>
      </div>

      <ProductsGridWithFilters
        key={`${categoria}|${q}|${safePage}`}
        items={itemsWithStock as any}
        emptyText="Nessun prodotto trovato."
        initialQuery={q}
      />
    </div>
  );
}