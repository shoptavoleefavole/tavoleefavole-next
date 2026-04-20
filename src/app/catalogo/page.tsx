// src/app/catalogo/page.tsx

/* eslint-disable @typescript-eslint/no-unused-vars */
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import ProductsGridWithFilters from "@/components/catalog/ProductsGridWithFilters";
import Breadcrumbs from "@/components/Breadcrumbs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Catalogo",
};

type CatalogoSearchParams = {
  categoria?: string;
  q?: string;
  page?: string;
};

const PAGE_SIZE = 24;

const STRAPI_URL = (
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  process.env.STRAPI_URL ||
  "http://localhost:1337"
).replace(/\/+$/, "");

const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN || "";

// ─── utils ────────────────────────────────────────────────────────────────────

function safeText(input: unknown, maxLen: number) {
  const s = String(input ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function safeSlug(input: unknown) {
  const s = safeText(input, 80).toLowerCase();
  if (!s) return "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) return "";
  return s;
}

function toInt(v: unknown, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const x = Math.floor(n);
  return x > 0 ? x : fallback;
}

function toIntOrNull(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

function toBoolOrNull(v: unknown) {
  return typeof v === "boolean" ? v : null;
}

function computeInStock(stockQty: unknown, trackInventory: unknown, fallbackInStock?: boolean) {
  if (trackInventory === false) return true;

  const qty = toIntOrNull(stockQty);
  if (qty !== null) return qty > 0;

  if (typeof fallbackInStock === "boolean") return fallbackInStock;

  return true;
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

function isOccasionCurrentlyActive(occasion?: {
  isActive?: boolean | null;
  startDate?: string | null;
  endDate?: string | null;
} | null) {
  if (!occasion) return true;
  if (occasion.isActive === true) return true;

  const today = todayYMDRome();
  const start = String(occasion.startDate ?? "").trim();
  const end = String(occasion.endDate ?? "").trim();

  if (!start && !end) return false;
  if (start && !end) return today >= start;
  if (!start && end) return today <= end;
  return today >= start && today <= end;
}

function shouldShowProductInCatalog(product: {
  visibleInStorefront?: boolean | null;
  hiddenFromCatalog?: boolean | null;
  categoryVisibleInStorefront?: boolean | null;
  visibilityOccasion?: {
    isActive?: boolean | null;
    startDate?: string | null;
    endDate?: string | null;
  } | null;
}) {
  if (product.visibleInStorefront === false) return false;
  if (product.hiddenFromCatalog === true) return false;
  if (product.categoryVisibleInStorefront === false) return false;
  if (!isOccasionCurrentlyActive(product.visibilityOccasion)) return false;
  return true;
}

// ─── normalize prodotto ───────────────────────────────────────────────────────

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

  const categoryNode =
    a?.category?.data ??
    a?.category ??
    a?.categories?.data?.[0] ??
    a?.categories?.[0] ??
    a?.categoria?.data ??
    a?.categoria ??
    null;

  const categoryAttr = categoryNode?.attributes ?? categoryNode ?? {};

  const categorySlug =
    categoryAttr?.slug ??
    a?.categories?.[0]?.slug ??
    a?.categorySlug ??
    a?.macroSlug ??
    a?.macroAreaSlug ??
    null;

  const visibilityOccasionNode =
    a?.visibilityOccasion?.data ??
    a?.visibilityOccasion ??
    null;

  const visibilityOccasionAttr =
    visibilityOccasionNode?.attributes ?? visibilityOccasionNode ?? null;

  const rawPriceAziende = a?.priceAziende ?? null;
  const priceAziende =
    rawPriceAziende !== null && Number.isFinite(Number(rawPriceAziende))
      ? Number(rawPriceAziende)
      : null;

  return {
    id: row?.documentId ?? row?.id ?? a?.documentId ?? a?.id ?? null,
    documentId: row?.documentId ?? a?.documentId ?? null,
    name: String(a?.name ?? a?.title ?? ""),
    slug: String(a?.slug ?? ""),
    price: a?.price ?? null,
    compareAtPrice: a?.compareAtPrice ?? null,
    shortDescription: String(a?.shortDescription ?? ""),
    inStock: a?.inStock ?? undefined,
    stockQty: toIntOrNull(a?.stockQty),
    trackInventory: typeof a?.trackInventory === "boolean" ? a.trackInventory : null,
    variants,
    image: imageUrl,
    imageUrl,
    categorySlug,
    priceAziende,
    visibleInStorefront: toBoolOrNull(a?.visibleInStorefront),
    hiddenFromCatalog: toBoolOrNull(a?.hiddenFromCatalog),
    categoryVisibleInStorefront: toBoolOrNull(categoryAttr?.visibleInStorefront),
    visibilityOccasion: visibilityOccasionAttr
      ? {
          isActive: toBoolOrNull(visibilityOccasionAttr?.isActive),
          startDate:
            typeof visibilityOccasionAttr?.startDate === "string"
              ? visibilityOccasionAttr.startDate
              : null,
          endDate:
            typeof visibilityOccasionAttr?.endDate === "string"
              ? visibilityOccasionAttr.endDate
              : null,
        }
      : null,
    __raw: a,
  };
}

// ─── fetch categoria ──────────────────────────────────────────────────────────

async function fetchCategoryBySlug(slug: string) {
  try {
    const qs = new URLSearchParams();
    qs.set("filters[slug][$eq]", slug);
    qs.set("pagination[pageSize]", "1");
    qs.set("populate", "*");

    const url = `${STRAPI_URL}/api/categories?${qs.toString()}`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8_000);

    const res = await fetch(url, {
      headers: getHeaders(),
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(t);

    if (!res.ok) return null;

    const text = await res.text().catch(() => "");
    const json = safeJsonParse(text);
    const data: any[] = Array.isArray(json?.data) ? json.data : [];
    if (!data.length) return null;

    const a = data[0]?.attributes ?? data[0] ?? {};
    return {
      id: data[0]?.id ?? null,
      documentId: data[0]?.documentId ?? null,
      slug: String(a?.slug ?? slug),
      label: String(a?.label ?? a?.name ?? a?.title ?? slug),
      visibleInStorefront: toBoolOrNull(a?.visibleInStorefront),
    };
  } catch {
    return null;
  }
}

// ─── fetch prodotti ───────────────────────────────────────────────────────────

function buildProductsQS(params: {
  categoria?: string;
  categoryId?: number | null;
  categoryDocumentId?: string | null;
  q?: string;
  page: number;
  pageSize: number;
  categoryFilterKey?: string;
  categoryMode?: "rel" | "scalar" | "id" | "documentId";
}) {
  const qs = new URLSearchParams();
  qs.set("populate", "*");
  qs.set("sort[0]", "createdAt:desc");
  qs.set("pagination[page]", String(params.page));
  qs.set("pagination[pageSize]", String(params.pageSize));

  if (params.categoryFilterKey) {
    const key = params.categoryFilterKey;
    if (params.categoryMode === "id" && params.categoryId) {
      qs.set(`filters[${key}][id][$eq]`, String(params.categoryId));
    } else if (params.categoryMode === "documentId" && params.categoryDocumentId) {
      qs.set(`filters[${key}][documentId][$eq]`, params.categoryDocumentId);
    } else if (params.categoryMode === "scalar" && params.categoria) {
      qs.set(`filters[${key}][$eq]`, params.categoria);
    } else if (params.categoryMode === "rel" && params.categoria) {
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
  categoryId?: number | null;
  categoryDocumentId?: string | null;
  q?: string;
  page: number;
  pageSize: number;
  categoryFilterKey?: string;
  categoryMode?: "rel" | "scalar" | "id" | "documentId";
}) {
  const qs = buildProductsQS(params);
  const url = `${STRAPI_URL}/api/products?${qs.toString()}`;
  const res = await fetch(url, { headers: getHeaders(), next: { revalidate: 30 } });

  const text = await res.text().catch(() => "");
  const json = safeJsonParse(text);

  if (!res.ok) {
    const isValidation = res.status === 400 && json?.error?.name === "ValidationError";
    return { ok: false as const, status: res.status, json, isValidation };
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

async function fetchProductsFromStrapi(params: {
  categoria?: string;
  q?: string;
  page: number;
  pageSize: number;
}) {
  const empty = {
    ok: true as const,
    items: [] as ReturnType<typeof normalizeStrapiProduct>[],
    pagination: { page: params.page, pageSize: params.pageSize, pageCount: 1, total: 0 },
  };

  if (!params.categoria) {
    const r = await fetchProductsOnce({ ...params });
    if (r.ok) return r;
    return empty;
  }

  const cat = await fetchCategoryBySlug(params.categoria);
  if (cat?.visibleInStorefront === false) return empty;

  type Attempt = {
    key: string;
    mode: "id" | "documentId" | "rel" | "scalar";
    categoryId?: number | null;
    categoryDocumentId?: string | null;
    categoria?: string;
  };

  const attempts: Attempt[] = [];

  if (cat?.id) {
    for (const key of ["category", "subcategory", "categoria", "macro"]) {
      attempts.push({ key, mode: "id", categoryId: cat.id });
    }
  }

  if (cat?.documentId) {
    for (const key of ["category", "subcategory", "categoria", "macro"]) {
      attempts.push({ key, mode: "documentId", categoryDocumentId: cat.documentId });
    }
  }

  for (const key of ["category", "subcategory", "categories", "categoria", "macro"]) {
    attempts.push({ key, mode: "rel", categoria: params.categoria });
  }

  for (const key of ["categorySlug", "macroSlug", "macroAreaSlug"]) {
    attempts.push({ key, mode: "scalar", categoria: params.categoria });
  }

  for (const a of attempts) {
    let r;
    try {
      r = await fetchProductsOnce({
        ...params,
        categoryFilterKey: a.key,
        categoryMode: a.mode,
        categoryId: a.categoryId ?? null,
        categoryDocumentId: a.categoryDocumentId ?? null,
        categoria: a.categoria ?? params.categoria,
      });
    } catch {
      continue;
    }

    if (r.ok && r.items.length > 0) return r;
    if (!r.ok && !r.isValidation) continue;
  }

  return empty;
}

function buildCatalogHref(params: { categoria?: string; q?: string; page?: number }) {
  const sp = new URLSearchParams();
  if (params.categoria) sp.set("categoria", params.categoria);
  if (params.q) sp.set("q", params.q);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/catalogo?${qs}` : "/catalogo";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams?: Promise<CatalogoSearchParams>;
}) {
  const sp = (await searchParams) ?? {};

  const categoria = safeSlug(sp.categoria);
  const q = safeText(sp.q, 80);
  const pageRequested = toInt(sp.page, 1);

  const cookieStore = await cookies();
  const tf = cookieStore.get("tf_token")?.value ?? null;

  let isBusiness = false;

  if (tf) {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/account/type`,
        { cache: "no-store", headers: { Cookie: cookieStore.toString() } }
      );
      if (res.ok) {
        const json = await res.json();
        isBusiness =
          String(json?.customerType ?? "").toUpperCase() === "BUSINESS" ||
          String(json?.customerType ?? "").toUpperCase() === "AZIENDE";
      }
    } catch {
      isBusiness = false;
    }
  }

  const macroFromStrapi = categoria ? await fetchCategoryBySlug(categoria) : null;
  const macro =
    macroFromStrapi ??
      (categoria ? { id: null, documentId: null, slug: categoria, label: categoria } : null);

  const res = await fetchProductsFromStrapi({
    categoria,
    q,
    page: pageRequested,
    pageSize: PAGE_SIZE,
  });

  let items = res.items;
  let pagination = res.pagination;

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

  const visibleItems = items.filter(shouldShowProductInCatalog);

  const itemsWithStock = visibleItems.map((p: any) => {
    const sku = getDefaultSku(p);

    return {
      ...p,
      inStock: computeInStock(p?.stockQty, p?.trackInventory, p?.inStock),
      sku,
      priceAziende: isBusiness ? (p?.priceAziende ?? null) : null,
    };
  });

  const total = itemsWithStock.length;
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
            {q ? ` Ricerca: "${q}".` : ""}
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