import Link from "next/link";
import { notFound } from "next/navigation";

import ProductsGridWithFilters from "@/components/catalog/ProductsGridWithFilters";
import Breadcrumbs from "@/components/Breadcrumbs";
import { getAvailability } from "@/lib/inventory.server";

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

const FETCH_TIMEOUT_MS = Number(process.env.CATEGORY_STRAPI_TIMEOUT_MS ?? 6500);
const PAGE_SIZE = 200; // per ora: lista ampia ma non infinita

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

function baseStrapiUrl() {
  return String(STRAPI_URL || "").trim().replace(/\/+$/, "");
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
  | { ok: true; status: number; json: any; text: string }
  | { ok: false; status: number; json: any | null; text: string; reason: "timeout" | "fetch_failed" | "http" };

async function fetchStrapi(pathOrUrl: string): Promise<FetchStrapiResult> {
  const base = baseStrapiUrl();
  if (!base) return { ok: false, status: 500, json: null, text: "STRAPI_URL missing", reason: "http" };

  const fullUrl =
    /^https?:\/\//i.test(pathOrUrl)
      ? pathOrUrl
      : `${base}${String(pathOrUrl).startsWith("/") ? "" : "/"}${pathOrUrl}`;

  const headersAuth: Record<string, string> = { Accept: "application/json" };
  if (STRAPI_TOKEN) headersAuth.Authorization = `Bearer ${STRAPI_TOKEN}`;
  const headersNoAuth: Record<string, string> = { Accept: "application/json" };

  const read = async (res: Response) => {
    const text = await res.text().catch(() => "");
    const json = text ? safeJsonParse(text) : null;
    return { text, json };
  };

  try {
    if (STRAPI_TOKEN) {
      const res = await fetchWithTimeout(fullUrl, { headers: headersAuth });
      const { text, json } = await read(res);
      if (res.ok) return { ok: true, status: res.status, json, text };
      if (res.status !== 401 && res.status !== 403) return { ok: false, status: res.status, json, text, reason: "http" };
      // fallback pubblico su 401/403
    }

    const res2 = await fetchWithTimeout(fullUrl, { headers: headersNoAuth });
    const { text, json } = await read(res2);
    if (res2.ok) return { ok: true, status: res2.status, json, text };
    return { ok: false, status: res2.status, json, text, reason: "http" };
  } catch (e: any) {
    const isAbort = e?.name === "AbortError";
    return {
      ok: false,
      status: isAbort ? 504 : 500,
      json: null,
      text: isAbort ? "Timeout Strapi" : String(e?.message || "fetch failed"),
      reason: isAbort ? "timeout" : "fetch_failed",
    };
  }
}

async function fetchMacroBySlug(slug: string): Promise<
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
    ? subsData
        .map((s: any) => {
          const sa = s?.attributes ?? s ?? {};
          const sSlug = safeStr(sa?.slug);
          if (!sSlug) return null;
          return { slug: sSlug, label: safeStr(sa?.label ?? sa?.name ?? sa?.title, sSlug) };
        })
        .filter(Boolean) as any
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

function getDefaultSku(item: any): string | null {
  return item?.variants?.[0]?.sku ?? item?.variant?.sku ?? null;
}

function normalizeProduct(row: any) {
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

  const imageUrl = absUrl(baseStrapiUrl(), imageUrlRaw);

  return {
    id: row?.documentId ?? row?.id ?? a?.documentId ?? a?.id ?? null,
    documentId: row?.documentId ?? a?.documentId ?? null,
    name: safeStr(a?.name ?? a?.title, "Prodotto"),
    slug: safeStr(a?.slug),
    price: a?.price ?? null,
    compareAtPrice: a?.compareAtPrice ?? null,
    shortDescription: a?.shortDescription ?? "",
    inStock: a?.inStock ?? undefined,
    variants,
    image: imageUrl,
    imageUrl,
    createdAt: a?.createdAt ?? row?.createdAt ?? null,
  };
}

async function fetchProductsByMacro(macroSlug: string) {
  const attempts: Array<{ key: string; mode: "rel" | "scalar" }> = [
    { key: "category", mode: "rel" },
    { key: "categories", mode: "rel" },
    { key: "categoria", mode: "rel" },
    { key: "macro", mode: "rel" },
    { key: "categorySlug", mode: "scalar" },
    { key: "macroSlug", mode: "scalar" },
  ];

  for (const a of attempts) {
    const qs = new URLSearchParams();

    qs.set("fields[0]", "name");
    qs.set("fields[1]", "slug");
    qs.set("fields[2]", "price");
    qs.set("fields[3]", "compareAtPrice");
    qs.set("fields[4]", "shortDescription");
    qs.set("fields[5]", "inStock");
    qs.set("fields[6]", "createdAt");

    qs.set("populate[images][fields][0]", "url");
    qs.set("populate[images][fields][1]", "formats");
    qs.set("populate[image][fields][0]", "url");
    qs.set("populate[image][fields][1]", "formats");
    qs.set("populate[variants][fields][0]", "sku");

    qs.set("sort[0]", "createdAt:desc");
    qs.set("pagination[pageSize]", String(PAGE_SIZE));

    if (a.mode === "scalar") qs.set(`filters[${a.key}][$eq]`, macroSlug);
    else qs.set(`filters[${a.key}][slug][$eq]`, macroSlug);

    const r = await fetchStrapi(`/api/products?${qs.toString()}`);

    if (!r.ok) return { kind: "unavailable" as const, items: [] as any[] };

    // validation => prova la chiave dopo
    const isValidation = r.status === 400 && r.json?.error?.name === "ValidationError";
    if (isValidation) continue;

    const data: any[] = Array.isArray(r.json?.data) ? r.json.data : [];
    return { kind: "ok" as const, items: data.map(normalizeProduct) };
  }

  // tutte validation => vuoto, ma niente crash
  return { kind: "ok" as const, items: [] as any[] };
}

export default async function MacroPage({
  params,
}: {
  params: Promise<{ macro: string }>;
}) {
  const { macro } = await params;
  const macroSlug = safeDecode(macro);
  if (!macroSlug) return notFound();

  const macroRes = await fetchMacroBySlug(macroSlug);

  if (macroRes.kind === "not_found") return notFound();

  const macroObj: MacroObj =
    macroRes.kind === "found"
      ? macroRes.macro
      : { slug: macroSlug, label: macroSlug, subcategories: [] };

  const prodRes = await fetchProductsByMacro(macroSlug);
  const items = prodRes.items ?? [];

  // Availability (mai deve rompere)
  const skus = Array.from(
    new Set(
      items
        .map((x: any) => getDefaultSku(x))
        .filter((s: unknown): s is string => typeof s === "string" && s.length > 0)
    )
  );

  let bySku: any = {};
  try {
    const availability = skus.length ? await getAvailability({ skus, warehouse: "MAIN" }) : null;
    bySku = (availability as any)?.data?.MAIN ?? {};
  } catch {
    bySku = {};
  }

  const itemsWithStock = items.map((it: any) => {
    const sku = getDefaultSku(it);
    const row = sku ? bySku?.[sku] ?? null : null;
    const available = Number(row?.available ?? 0);

    return {
      ...it,
      inStock: sku ? available > 0 : Boolean(it?.inStock),
      inventory: row,
      sku,
    };
  });

  const hasProducts = itemsWithStock.length > 0;
  const strapiDown = macroRes.kind === "unavailable" || prodRes.kind === "unavailable";

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
            {macroObj.subcategories?.length ? "oppure scegli una sottocategoria." : "."}
          </p>
        </div>

        <Link href="/catalogo" className="text-sm font-semibold text-link hover:text-link-hover">
          Torna al catalogo
        </Link>
      </div>

      {strapiDown ? (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm font-semibold">Catalogo momentaneamente non disponibile.</p>
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
            <p className="text-sm font-semibold">Nessun prodotto disponibile in questa macroarea.</p>
            <p className="mt-2 text-sm text-text/70">
              Prova un’altra categoria oppure torna al catalogo completo.
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
