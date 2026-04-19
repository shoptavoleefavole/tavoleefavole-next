// src/app/categoria/[macro]/page.tsx

import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import ProductsGridWithFilters from "@/components/catalog/ProductsGridWithFilters";
import Breadcrumbs from "@/components/Breadcrumbs";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type Subcat = { slug: string; label: string };
type MacroObj = { slug: string; label: string; subcategories: Subcat[] };

const STRAPI_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  process.env.STRAPI_URL ||
  "http://localhost:1337";

const STRAPI_TOKEN =
  process.env.STRAPI_API_TOKEN ||
  process.env.STRAPI_TOKEN ||
  process.env.NEXT_PUBLIC_STRAPI_API_TOKEN ||
  process.env.NEXT_PUBLIC_STRAPI_TOKEN ||
  "";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://tavoleefavole-next-t7pd.vercel.app"
).replace(/\/+$/, "");

const FETCH_TIMEOUT_MS = Number(process.env.CATEGORY_STRAPI_TIMEOUT_MS ?? 6500);
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

function safeStr(v: unknown, fallback = "") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
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

function toNumberOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toIntOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

function computeInStock(stockQty: unknown, trackInventory: unknown, fallbackInStock?: boolean) {
  if (trackInventory === false) return true;

  const qty = toIntOrNull(stockQty);
  if (qty !== null) return qty > 0;

  if (typeof fallbackInStock === "boolean") return fallbackInStock;

  return true;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), init.timeoutMs ?? FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

type FetchStrapiResult =
  | { ok: true; status: number; json: any; text: string; base: string }
  | {
      ok: false;
      status: number;
      json: any | null;
      text: string;
      base: string;
      reason: "timeout" | "fetch_failed" | "http";
    };

async function fetchStrapi(pathOrUrl: string): Promise<FetchStrapiResult> {
  const base = normalizedStrapiBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 500,
      json: null,
      text: "STRAPI_URL missing",
      base: "",
      reason: "http",
    };
  }

  const fullUrl =
    /^https?:\/\//i.test(pathOrUrl)
      ? pathOrUrl
      : `${base}${String(pathOrUrl).startsWith("/") ? "" : "/"}${pathOrUrl}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (STRAPI_TOKEN) headers.Authorization = `Bearer ${STRAPI_TOKEN}`;

  const read = async (res: Response) => {
    const text = await res.text().catch(() => "");
    const json = text ? safeJsonParse(text) : null;
    return { text, json };
  };

  try {
    const res = await fetchWithTimeout(fullUrl, { headers });
    const { text, json } = await read(res);

    if (res.ok) return { ok: true, status: res.status, json, text, base };
    return { ok: false, status: res.status, json, text, base, reason: "http" };
  } catch (e: any) {
    const isAbort = e?.name === "AbortError";
    return {
      ok: false,
      status: isAbort ? 504 : 500,
      json: null,
      text: isAbort ? "Timeout Strapi" : String(e?.message || "fetch failed"),
      base,
      reason: isAbort ? "timeout" : "fetch_failed",
    };
  }
}

// ─── Business user check ──────────────────────────────────────────────────────

async function checkIsBusiness(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const tf = cookieStore.get("tf_token")?.value ?? null;
    if (!tf) return false;

    // Validazione base: deve sembrare un JWT (3 parti base64)
    const parts = tf.split(".");
    if (parts.length !== 3) return false;

    const res = await fetchWithTimeout(
      `${SITE_URL}/api/account/type`,
      { headers: { Cookie: cookieStore.toString() }, cache: "no-store", timeoutMs: 8000 }
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

// ─── fetch macro ──────────────────────────────────────────────────────────────

async function fetchMacroBySlug(
  slug: string
): Promise<
  | { kind: "found"; macro: MacroObj }
  | { kind: "not_found" }
  | { kind: "unavailable" }
> {
  const qs = new URLSearchParams();
  qs.set("filters[slug][$eq]", slug);
  qs.set("pagination[pageSize]", "1");
  qs.set("fields[0]", "label");
  qs.set("fields[1]", "slug");
  qs.set("populate[subcategories][fields][0]", "label");
  qs.set("populate[subcategories][fields][1]", "slug");

  const r = await fetchStrapi(`/api/categories?${qs.toString()}`);
  if (!r.ok) return { kind: "unavailable" };

  const data: any[] = Array.isArray(r.json?.data) ? r.json.data : [];
  if (!data.length) return { kind: "not_found" };

  const row = data[0];
  const a = row?.attributes ?? row ?? {};
  const subsData = a?.subcategories?.data ?? a?.subcategories ?? [];

  const subcategories: Subcat[] = Array.isArray(subsData)
    ? subsData.flatMap((s: any) => {
        const sa = s?.attributes ?? s ?? {};
        const sSlug = safeStr(sa?.slug);
        if (!sSlug) return [];
        return [
          { slug: sSlug, label: safeStr(sa?.label ?? sa?.name ?? sa?.title, sSlug) },
        ];
      })
    : [];

  return {
    kind: "found",
    macro: {
      slug: safeStr(a?.slug, slug),
      label: safeStr(a?.label ?? a?.name ?? a?.title, slug),
      subcategories,
    },
  };
}

// ─── helpers prodotto ─────────────────────────────────────────────────────────

function getDefaultSku(item: any): string | null {
  return item?.variants?.[0]?.sku ?? item?.variant?.sku ?? null;
}

function pickBestMediaUrl(node: any): string | null {
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
  return typeof u === "string" ? u : null;
}

function normalizeProduct(row: any, base: string) {
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
  const bestRaw =
    pickBestMediaUrl(firstImage) ??
    (typeof a?.imageUrl === "string" ? a.imageUrl : null);
  const imageUrl = absUrl(base, bestRaw);

  const stockQty = toIntOrNull(a?.stockQty);
  const trackInventory =
    typeof a?.trackInventory === "boolean" ? a.trackInventory : null;

  const slug = safeStr(a?.slug);
  const id = safeStr(
    row?.documentId ?? row?.id ?? a?.documentId ?? a?.id,
    slug || "0"
  );

  // priceAziende: incluso qui, filtrato server-side prima di passare al client
  const rawPriceAziende = a?.priceAziende ?? null;
  const priceAziende =
    rawPriceAziende !== null && Number.isFinite(Number(rawPriceAziende))
      ? Number(rawPriceAziende)
      : null;

  return {
    id: String(id),
    documentId: row?.documentId ?? a?.documentId ?? null,
    name: safeStr(a?.name ?? a?.title, "Prodotto"),
    slug,
    price: toNumberOrNull(a?.price),
    compareAtPrice: toNumberOrNull(a?.compareAtPrice),
    priceAziende, // nascosto se utente non Business — vedi itemsWithStock
    shortDescription: a?.shortDescription ?? "",
    inStock: typeof a?.inStock === "boolean" ? a.inStock : undefined,
    stockQty,
    trackInventory,
    variants,
    image: imageUrl ?? undefined,
    images: imageUrl ? [imageUrl] : undefined,
    createdAt: a?.createdAt ?? row?.createdAt ?? null,
  };
}

// ─── fetch prodotti per macro ─────────────────────────────────────────────────

async function fetchProductsByMacro(macroSlug: string) {
  const base = normalizedStrapiBaseUrl();

  const attempts: Array<{ label: string; build: () => URLSearchParams }> = [
    {
      label: "category.slug",
      build: () => {
        const qs = new URLSearchParams();
        qs.set("populate", "*");
        qs.set("pagination[pageSize]", String(PAGE_SIZE));
        qs.set("sort[0]", "createdAt:desc");
        qs.set("filters[category][slug][$eq]", macroSlug);
        return qs;
      },
    },
    {
      label: "subcategory.category.slug",
      build: () => {
        const qs = new URLSearchParams();
        qs.set("populate", "*");
        qs.set("pagination[pageSize]", String(PAGE_SIZE));
        qs.set("sort[0]", "createdAt:desc");
        qs.set("filters[subcategory][category][slug][$eq]", macroSlug);
        return qs;
      },
    },
    {
      label: "categories.slug",
      build: () => {
        const qs = new URLSearchParams();
        qs.set("populate", "*");
        qs.set("pagination[pageSize]", String(PAGE_SIZE));
        qs.set("sort[0]", "createdAt:desc");
        qs.set("filters[categories][slug][$eq]", macroSlug);
        return qs;
      },
    },
  ];

  const allItems: any[] = [];

  for (const attempt of attempts) {
    const qs = attempt.build();
    const r = await fetchStrapi(`/api/products?${qs.toString()}`);

    const isValidation =
      r.status === 400 && r.json?.error?.name === "ValidationError";
    if (!r.ok && isValidation) continue;
    if (!r.ok) return { kind: "unavailable" as const, items: [] as any[] };

    const data: any[] = Array.isArray(r.json?.data) ? r.json.data : [];
    if (data.length === 0) continue;

    const existingIds = new Set(allItems.map((x) => x.documentId ?? x.id));
    for (const row of data) {
      const normalized = normalizeProduct(row, base);
      if (!existingIds.has(normalized.documentId ?? normalized.id)) {
        allItems.push(normalized);
        existingIds.add(normalized.documentId ?? normalized.id);
      }
    }

    if (allItems.length > 0) break;
  }

  return { kind: "ok" as const, items: allItems };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function MacroPage({
  params,
}: {
  params: Promise<{ macro: string }>;
}) {
  const { macro } = await params;
  const macroSlug = safeDecode(macro);
  if (!macroSlug) return notFound();

  // Esegui in parallelo: macro + check business + prodotti
  const [macroRes, isBusiness] = await Promise.all([
    fetchMacroBySlug(macroSlug),
    checkIsBusiness(),
  ]);

  if (macroRes.kind === "not_found") return notFound();

  const macroObj: MacroObj =
    macroRes.kind === "found"
      ? macroRes.macro
      : { slug: macroSlug, label: macroSlug, subcategories: [] };

  const prodRes = await fetchProductsByMacro(macroSlug);
  const items = prodRes.items ?? [];

  const itemsWithStock = items.map((it: any) => {
    const sku = getDefaultSku(it);

    return {
      ...it,
      inStock: computeInStock(it?.stockQty, it?.trackInventory, it?.inStock),
      sku,
      priceAziende: isBusiness ? (it?.priceAziende ?? null) : null,
    };
  });

  const hasProducts = itemsWithStock.length > 0;
  const strapiDown =
    macroRes.kind === "unavailable" || prodRes.kind === "unavailable";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Catalogo", href: "/catalogo" },
          { label: macroObj.label },
        ]}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">{macroObj.label}</h1>
          <p className="mt-1 text-sm text-text/70">
            Esplora la macroarea e filtra i prodotti{" "}
            {macroObj.subcategories?.length
              ? "oppure scegli una sottocategoria."
              : "."}
          </p>
        </div>

        <Link
          href="/catalogo"
          className="text-sm font-semibold text-link hover:text-link-hover"
        >
          Torna al catalogo
        </Link>
      </div>

      {strapiDown ? (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm font-semibold">
            Catalogo momentaneamente non disponibile.
          </p>
          <p className="mt-2 text-sm text-text/70">
            Stiamo riattivando il servizio. Puoi comunque tornare al catalogo.
          </p>
          <Link
            href="/catalogo"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover"
          >
            Vai al catalogo
          </Link>
        </div>
      ) : null}

      {macroObj.subcategories?.length > 0 ? (
        <div className="mt-6">
          <h2 className="text-lg font-bold">Sottocategorie</h2>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {macroObj.subcategories.map((sub) => (
              <Link
                key={sub.slug}
                href={`/categoria/${macroObj.slug}/${sub.slug}`}
                className={[
                  "rounded-2xl border border-border bg-background px-4 py-3 hover:bg-surface-2",
                  "flex items-center justify-center text-center",
                  "whitespace-normal break-words leading-tight",
                  "text-sm font-semibold",
                  "min-h-[56px]",
                ].join(" ")}
                title={sub.label}
              >
                {sub.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-8">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-bold">Prodotti</h2>
        </div>

        {!hasProducts ? (
          <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
            <p className="text-sm font-semibold">
              Nessun prodotto disponibile in questa macroarea.
            </p>
            <p className="mt-2 text-sm text-text/70">
              Prova un&apos;altra categoria oppure torna al catalogo completo.
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
            emptyText="Nessun prodotto trovato in questa macroarea."
          />
        )}
      </div>
    </div>
  );
}
