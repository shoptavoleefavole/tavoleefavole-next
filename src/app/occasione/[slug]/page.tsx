// src/app/occasione/[slug]/page.tsx
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
  "https://tavoleefavole-next-t7pd.vercel.app"
).replace(/\/+$/, "");

const PAGE_SIZE = 200;

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
  try { return JSON.parse(text); } catch { return null; }
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

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 25_000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

async function fetchWithRetry(url: string, init: RequestInit = {}, ms = 25_000) {
  let lastErr: any;
  for (let i = 0; i < 3; i++) {
    try { return await fetchWithTimeout(url, init, ms); }
    catch (e: any) {
      lastErr = e;
      if (!isRetryableFetchError(e) || i === 2) break;
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

async function fetchStrapi(path: string) {
  const base = normalizedStrapiBaseUrl();
  if (!base) return { ok: false, status: 500, json: null, base: "" };
  const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (STRAPI_TOKEN) headers.Authorization = `Bearer ${STRAPI_TOKEN}`;
  try {
    const res = await fetchWithRetry(url, { headers });
    const text = await res.text().catch(() => "");
    const json = text ? safeJsonParse(text) : null;
    return { ok: res.ok, status: res.status, json, base };
  } catch {
    return { ok: false, status: 0, json: null, base };
  }
}

// ─── Business check ───────────────────────────────────────────────────────────

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
    const json = safeJsonParse(await res.text().catch(() => ""));
    const ct = String(json?.customerType ?? "").toUpperCase();
    return ct === "AZIENDE" || ct === "BUSINESS";
  } catch {
    return false;
  }
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
        f?.large?.url ?? f?.medium?.url ?? f?.small?.url ??
        f?.thumbnail?.url ?? a?.url ?? node?.url ?? null;
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
    extractMediaUrls(base, a?.image).length  ? extractMediaUrls(base, a?.image) :
    extractMediaUrls(base, a?.cover).length  ? extractMediaUrls(base, a?.cover) :
    extractMediaUrls(base, a?.thumbnail);

  const variantsData = a?.variants?.data ?? a?.variants ?? [];
  const variants = Array.isArray(variantsData)
    ? variantsData.map((v: any) => {
        const va = v?.attributes ?? v ?? {};
        return va?.sku ? { sku: String(va.sku) } : null;
      }).filter(Boolean)
    : [];

  const rawPriceAziende = a?.priceAziende ?? null;
  const priceAziende =
    rawPriceAziende !== null && Number.isFinite(Number(rawPriceAziende))
      ? Number(rawPriceAziende) : null;

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

async function fetchProductsByOccasion(occasionSlug: string) {
  const base = normalizedStrapiBaseUrl();

  const attempts = [
    (() => {
      const qs = new URLSearchParams();
      qs.set("pagination[pageSize]", String(PAGE_SIZE));
      qs.set("sort[0]", "createdAt:desc");
      qs.set("filters[category][slug][$eq]", occasionSlug);
      qs.set("populate", "*");
      return { label: "category.slug", qs };
    })(),
    (() => {
      const qs = new URLSearchParams();
      qs.set("pagination[pageSize]", String(PAGE_SIZE));
      qs.set("sort[0]", "createdAt:desc");
      qs.set("filters[occasion][slug][$eq]", occasionSlug);
      qs.set("populate", "*");
      return { label: "occasion.slug", qs };
    })(),
    (() => {
      const qs = new URLSearchParams();
      qs.set("pagination[pageSize]", String(PAGE_SIZE));
      qs.set("sort[0]", "createdAt:desc");
      qs.set("filters[tags][slug][$eq]", occasionSlug);
      qs.set("populate", "*");
      return { label: "tags.slug", qs };
    })(),
  ];

  for (const attempt of attempts) {
    const r = await fetchStrapi(`/api/products?${attempt.qs.toString()}`);
    if (r.status === 400) continue;
    if (!r.ok) return [];
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
  } catch {
    return null;
  }
}

// ─── Tema per occasione ───────────────────────────────────────────────────────

const OCCASION_META: Record<string, {
  label: string;
  emoji: string;
  bg: string;
  decorations: { emoji: string; top: string; left?: string; right?: string; rotate: string; opacity: string; size: string }[];
}> = {
  pasqua: {
    label: "Pasqua",
    emoji: "🐣",
    bg:
      "radial-gradient(ellipse at 15% 10%, rgba(134,239,172,0.28) 0%, transparent 50%)," +
      "radial-gradient(ellipse at 85% 8%,  rgba(251,207,232,0.32) 0%, transparent 45%)," +
      "radial-gradient(ellipse at 50% 85%, rgba(253,230,138,0.22) 0%, transparent 50%)," +
      "radial-gradient(ellipse at 92% 55%, rgba(167,243,208,0.18) 0%, transparent 40%)," +
      "linear-gradient(160deg, #fdf8f0 0%, #fffcf0 40%, #f2fdf4 100%)",
    decorations: [
      { emoji: "🐣", top: "6%",  left:  "3%",  rotate: "-15deg", opacity: "0.10", size: "3.5rem" },
      { emoji: "🌸", top: "12%", right: "5%",  rotate: "12deg",  opacity: "0.10", size: "3rem"   },
      { emoji: "🥚", top: "38%", left:  "1%",  rotate: "-8deg",  opacity: "0.09", size: "3rem"   },
      { emoji: "🐰", top: "55%", right: "2%",  rotate: "20deg",  opacity: "0.10", size: "3.5rem" },
      { emoji: "🌷", top: "78%", left:  "8%",  rotate: "5deg",   opacity: "0.09", size: "2.8rem" },
      { emoji: "🍫", top: "22%", left:  "44%", rotate: "-10deg", opacity: "0.07", size: "2.5rem" },
      { emoji: "🌼", top: "88%", right: "12%", rotate: "15deg",  opacity: "0.09", size: "3rem"   },
      { emoji: "🥚", top: "68%", left:  "30%", rotate: "8deg",   opacity: "0.06", size: "2.2rem" },
    ],
  },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function OccasionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: slugParam } = await params;
  const slug = String(slugParam ?? "").trim().toLowerCase();

  if (!slug || !OCCASION_META[slug]) return notFound();

  const meta = OCCASION_META[slug];

  const [isBusiness, items] = await Promise.all([
    checkIsBusiness(),
    fetchProductsByOccasion(slug).catch(() => []),
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

  return (
    <div
      className="relative min-h-screen"
      style={{ background: meta.bg }}
    >
      {/* ── Decorazioni tema ── */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden -z-10 select-none">
        {meta.decorations.map((d, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              top: d.top,
              ...(d.left  ? { left:  d.left  } : {}),
              ...(d.right ? { right: d.right } : {}),
              fontSize: d.size,
              opacity: d.opacity,
              transform: `rotate(${d.rotate})`,
              lineHeight: 1,
            }}
          >
            {d.emoji}
          </span>
        ))}
      </div>

      {/* ── Contenuto ── */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Catalogo", href: "/catalogo" },
            { label: `${meta.emoji} ${meta.label}` },
          ]}
        />

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold">
              {meta.emoji} {meta.label}
            </h1>
            <p className="mt-1 text-sm text-text/70">
              Filtra e ordina i prodotti della selezione.
            </p>
          </div>
          <Link href="/catalogo" className="text-sm font-semibold text-link hover:text-link-hover">
            Torna al catalogo
          </Link>
        </div>

        {!hasProducts ? (
          <div className="mt-6 rounded-2xl border border-border bg-white/80 backdrop-blur-sm p-5">
            <p className="text-sm font-semibold">
              Nessun prodotto disponibile per questa occasione.
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
            emptyText="Nessun prodotto trovato per questa occasione."
          />
        )}
      </div>
    </div>
  );
}
