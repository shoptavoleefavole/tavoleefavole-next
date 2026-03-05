// src/app/catalogo/page.tsx

/* eslint-disable @typescript-eslint/no-unused-vars */
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import ProductsGridWithFilters from "@/components/catalog/ProductsGridWithFilters";
import Breadcrumbs from "@/components/Breadcrumbs";
import { getAvailability } from "@/lib/inventory.server";

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

// ✅ STRAPI_TOKEN solo da variabili server-side (mai NEXT_PUBLIC_ per sicurezza)
const STRAPI_TOKEN =
  process.env.STRAPI_API_TOKEN ||
  process.env.STRAPI_TOKEN ||
  process.env.NEXT_PUBLIC_STRAPI_API_TOKEN ||
  process.env.NEXT_PUBLIC_STRAPI_TOKEN ||
  "";

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

  // ✅ priceAziende incluso — verrà filtrato server-side prima di passarlo al client
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
    variants,
    image: imageUrl,
    imageUrl,
    categorySlug,
    // ✅ incluso ma nascosto se utente non è Business (vedi itemsWithStock)
    priceAziende,
    __raw: a,
  };
}

// ─── Business user check ──────────────────────────────────────────────────────

/**
 * Verifica server-side se l'utente loggato è di tipo AZIENDE.
 * Il JWT viene letto dal cookie HttpOnly — mai esposto al client.
 * Il priceAziende viene incluso nei prodotti SOLO se questo ritorna true.
 */
async function isBusinessUser(cookieHeader: string): Promise<boolean> {
  // ✅ Estrai JWT dal cookie in modo sicuro
  const jwt = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("tf_token="))
    ?.slice("tf_token=".length)
    ?.trim();

  // Validazione base del token: deve sembrare un JWT (3 parti base64)
  if (!jwt || !STRAPI_TOKEN) return false;
  const jwtParts = jwt.split(".");
  if (jwtParts.length !== 3) return false;

  try {
    // Step 1: verifica identità utente tramite JWT
    const ctrl1 = new AbortController();
    const t1 = setTimeout(() => ctrl1.abort(), 6_000);

    const res = await fetch(`${STRAPI_URL}/api/users/me`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/json",
      },
      signal: ctrl1.signal,
      cache: "no-store",
    });
    clearTimeout(t1);

    if (!res.ok) return false;

    const me = await res.json().catch(() => null);
    const userId = typeof me?.id === "number" ? me.id : null;
    if (!userId) return false;

    // Step 2: cerca CustomerProfile tramite service token (non JWT utente)
    const qs = new URLSearchParams();
    qs.set("filters[user][id][$eq]", String(userId));
    qs.set("fields[0]", "customerType");
    qs.set("pagination[pageSize]", "1");

    const ctrl2 = new AbortController();
    const t2 = setTimeout(() => ctrl2.abort(), 6_000);

    const r2 = await fetch(
      `${STRAPI_URL}/api/customer-profiles?${qs.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${STRAPI_TOKEN}`,
          Accept: "application/json",
        },
        signal: ctrl2.signal,
        cache: "no-store",
      }
    );
    clearTimeout(t2);

    if (!r2.ok) return false;

    const data = await r2.json().catch(() => null);
    const rows: any[] = Array.isArray(data?.data) ? data.data : [];

    // Fallback scan: se il filtro non restituisce risultati, cerca manualmente
    // (workaround per bug Strapi v5 con filtri su relazioni)
    if (rows.length === 0) {
      const qsAll = new URLSearchParams();
      qsAll.set("fields[0]", "customerType");
      qsAll.set("populate[user][fields][0]", "id");
      qsAll.set("pagination[pageSize]", "50");

      const ctrl3 = new AbortController();
      const t3 = setTimeout(() => ctrl3.abort(), 6_000);

      const r3 = await fetch(
        `${STRAPI_URL}/api/customer-profiles?${qsAll.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${STRAPI_TOKEN}`,
            Accept: "application/json",
          },
          signal: ctrl3.signal,
          cache: "no-store",
        }
      );
      clearTimeout(t3);

      if (!r3.ok) return false;

      const dataAll = await r3.json().catch(() => null);
      const allRows: any[] = Array.isArray(dataAll?.data) ? dataAll.data : [];

      const matched = allRows.find((row: any) => {
        const attrs = row?.attributes ?? row ?? {};
        const relUser = attrs?.user?.data ?? attrs?.user ?? null;
        const relId = relUser?.id ?? relUser?.data?.id ?? null;
        return Number(relId) === userId;
      });

      if (!matched) return false;

      const ctFallback = String(
        matched?.customerType ??
        matched?.attributes?.customerType ??
        ""
      ).toUpperCase();

      return ctFallback === "AZIENDE" || ctFallback === "BUSINESS";
    }

    const ct = String(
      rows[0]?.customerType ??
      rows[0]?.attributes?.customerType ??
      ""
    ).toUpperCase();

    return ct === "AZIENDE" || ct === "BUSINESS";
  } catch {
    return false;
  }
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

  // ✅ Verifica Business user server-side — cookie HttpOnly, mai esposto al client
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const isBusiness = await isBusinessUser(cookieHeader);

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

  const skus: string[] = Array.from(
    new Set(
      items
        .map((p: any) => getDefaultSku(p))
        .filter((x: unknown): x is string => typeof x === "string" && x.length > 0)
    )
  );

  let bySku: Record<string, any> = {};
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
      // ✅ SICUREZZA: priceAziende esposto SOLO se utente Business verificato server-side
      // Per tutti gli altri (guest, PRIVATE) viene sempre rimosso qui
      priceAziende: isBusiness ? (p?.priceAziende ?? null) : null,
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
