import Stripe from "stripe";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ✅ Server-pricing robusto:
 * - Guest ok
 * - Prezzi sempre da Strapi
 * - Prezzi aziende solo se approved
 * - Cialde: prezzo server-side
 * - Inventory check (SKU, warehouse MAIN)
 *
 * ✅ Hardening:
 * - no secrets in response
 * - no throw/import-time env checks (build-safe)
 * - retry+timeout per Strapi
 */

type CartItemMeta = Record<string, any>;

type CartItem = {
  productId?: number | string;
  id?: number | string;
  slug?: string;

  name?: string;
  price?: number; // ignored
  qty: number;
  imageUrl?: string;
  variantId?: number | null;

  meta?: CartItemMeta;
};

type BillingType = "PRIVATE" | "AZIENDE";

type ApiBody = {
  items?: any;
  currency?: string;
  shippingTotal?: number;
  billingType?: BillingType | string;
  billingSnapshot?: any;
  customerEmail?: string;
};

function jsonNoStore(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "x-checkout-route": "start",
    },
  });
}

function safeJsonParse(text: string) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function readBodySafe(request: Request): Promise<{ body: ApiBody | null; raw: string }> {
  const raw = await request.text().catch(() => "");
  if (!raw) return { body: null, raw: "" };
  const parsed = safeJsonParse(raw);
  return { body: (parsed as ApiBody) ?? null, raw };
}

function getCookieValue(cookieHeader: string, name: string) {
  const parts = cookieHeader.split(";").map((p) => p.trim());
  const hit = parts.find((p) => p.startsWith(`${name}=`));
  if (!hit) return null;
  return decodeURIComponent(hit.slice(name.length + 1));
}

function clampNumber(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toSafeString(v: any, fallback = "") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function toIntStrict(v: any): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    if (!/^\d+$/.test(s)) return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return Math.trunc(n);
  }
  return null;
}

function isPlainObject(x: any) {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function sanitizeMeta(meta: any): CartItemMeta | undefined {
  if (!isPlainObject(meta)) return undefined;

  const out: CartItemMeta = {};
  const allow = ["kind", "href", "shape", "material", "text", "imageUrl", "notes", "lineId"];

  for (const k of allow) {
    const v = meta[k];
    if (v == null) continue;
    if (typeof v === "string") out[k] = v.slice(0, 500);
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
  }

  return Object.keys(out).length ? out : undefined;
}

function normalizeItems(input: any): CartItem[] {
  if (!Array.isArray(input)) return [];
  const out: CartItem[] = [];

  for (const it of input) {
    const qtyRaw = clampNumber(it?.qty, NaN);
    const qty = Number.isFinite(qtyRaw) ? Math.floor(qtyRaw) : NaN;
    if (!Number.isFinite(qty) || qty <= 0) continue;

    const productIdNum = toIntStrict(it?.productId);
    const idNum = toIntStrict(it?.id);

    const slug =
      typeof it?.slug === "string" && it.slug.trim()
        ? it.slug.trim()
        : typeof it?.productSlug === "string" && it.productSlug.trim()
        ? it.productSlug.trim()
        : undefined;

    const meta = sanitizeMeta(it?.meta);
    const isCustom = typeof meta?.kind === "string" && meta.kind.trim().length > 0;

    if (!productIdNum && !idNum && !slug && !isCustom) continue;

    out.push({
      productId: productIdNum ?? undefined,
      id: idNum ?? undefined,
      slug,
      name: typeof it?.name === "string" ? it.name : undefined,
      qty,
      imageUrl: typeof it?.imageUrl === "string" ? it.imageUrl : undefined,
      variantId: typeof it?.variantId === "number" || it?.variantId === null ? it.variantId : undefined,
      meta,
    });
  }

  return out;
}

function normalizeBillingType(input: any): BillingType {
  const v = String(input || "").toUpperCase();
  if (v === "COMPANY" || v === "AZIENDE") return "AZIENDE";
  return "PRIVATE";
}

function pickStr(...vals: any[]) {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return "";
}

function normalizeBillingSnapshot(input: any, billingType: BillingType) {
  const src = input && typeof input === "object" ? input : {};

  if (billingType === "PRIVATE") {
    return {
      type: "PRIVATE",
      firstName: pickStr(src.firstName, src.nome),
      lastName: pickStr(src.lastName, src.cognome),
      fiscalCode: pickStr(src.fiscalCode, src.codiceFiscale),
      email: pickStr(src.email),
      phone: pickStr(src.phone, src.telefono),
      address: pickStr(src.address, src.indirizzo),
      city: pickStr(src.city, src.citta),
      postalCode: pickStr(src.postalCode, src.cap),
      province: pickStr(src.province, src.provincia),
      country: pickStr(src.country, src.paese, "IT"),
    };
  }

  return {
    type: "AZIENDE",
    companyName: pickStr(src.companyName, src.ragioneSociale, src.name),
    vatNumber: pickStr(src.vatNumber, src.piva, src.partitaIva),
    sdi: pickStr(src.sdi, src.codiceSdi),
    pec: pickStr(src.pec),
    billingEmail: pickStr(src.billingEmail, src.email),
    address: pickStr(src.address, src.indirizzo),
    city: pickStr(src.city, src.citta),
    postalCode: pickStr(src.postalCode, src.cap),
    province: pickStr(src.province, src.provincia),
    country: pickStr(src.country, src.paese, "IT"),
  };
}

function validateCompanySnapshot(snap: any) {
  if (!pickStr(snap?.companyName)) return "Ragione sociale mancante";
  if (!pickStr(snap?.vatNumber)) return "Partita IVA mancante";
  return null;
}

function normalizeSiteUrl(raw: string) {
  let s = String(raw || "").trim();
  if (!s) s = "http://localhost:3000";
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  s = s.replace(/\/+$/, "");
  // eslint-disable-next-line no-new
  new URL(s);
  return s;
}

function normalizeCurrency(input: any) {
  const cur = String(input || "EUR").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(cur)) return "EUR";
  return cur;
}

function strapiBaseUrl(raw: string) {
  return String(raw || "").replace(/\/+$/, "");
}

const STRAPI_TIMEOUT_MS = (() => {
  const n = Number(process.env.STRAPI_TIMEOUT_MS || 25000);
  return Number.isFinite(n) ? Math.max(5000, n) : 25000;
})();

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

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 30_000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function fetchWithRetry(url: string, init: RequestInit = {}, ms = STRAPI_TIMEOUT_MS) {
  let lastErr: any;

  for (let i = 0; i < 3; i++) {
    try {
      return await fetchWithTimeout(url, init, ms);
    } catch (e: any) {
      lastErr = e;
      if (!isRetryableFetchError(e) || i === 2) break;
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, i)));
    }
  }

  throw lastErr;
}

async function strapiRequest(
  STRAPI_URL: string,
  STRAPI_API_TOKEN: string,
  path: string,
  init: RequestInit,
  timeoutMs = STRAPI_TIMEOUT_MS
) {
  const url = `${strapiBaseUrl(STRAPI_URL)}${path}`;
  const res = await fetchWithRetry(
    url,
    {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    },
    timeoutMs
  );

  const text = await res.text().catch(() => "");
  const data = text ? safeJsonParse(text) : null;
  return { res, text, data, url };
}

/** Stripe: zero-decimal currencies */
function isZeroDecimalCurrency(currency: string) {
  const zero = new Set([
    "BIF",
    "CLP",
    "DJF",
    "GNF",
    "JPY",
    "KMF",
    "KRW",
    "MGA",
    "PYG",
    "RWF",
    "UGX",
    "VND",
    "VUV",
    "XAF",
    "XOF",
    "XPF",
  ]);
  return zero.has(String(currency || "").toUpperCase());
}

function toStripeUnitAmount(priceMajor: number, currency: string) {
  if (!Number.isFinite(priceMajor) || priceMajor <= 0) return null;
  if (isZeroDecimalCurrency(currency)) return Math.round(priceMajor);
  return Math.round(priceMajor * 100);
}

function toMajor(amountMinor: number, currency: string) {
  if (isZeroDecimalCurrency(currency)) return amountMinor;
  return amountMinor / 100;
}

function extractOrderRefs(orderJson: any): { orderId: number | null; documentId: string | null } {
  const root = orderJson?.data ?? orderJson ?? null;
  if (!root) return { orderId: null, documentId: null };

  const id = typeof root?.id === "number" ? root.id : null;
  const doc1 = typeof root?.documentId === "string" ? root.documentId : null;
  const doc2 = typeof root?.attributes?.documentId === "string" ? root.attributes.documentId : null;

  return { orderId: id, documentId: doc1 || doc2 || null };
}

async function findNumericOrderIdByDocumentId(args: {
  STRAPI_URL: string;
  STRAPI_API_TOKEN: string;
  documentId: string;
}) {
  const { STRAPI_URL, STRAPI_API_TOKEN, documentId } = args;

  const qs = new URLSearchParams();
  qs.set("filters[documentId][$eq]", documentId);
  qs.set("pagination[pageSize]", "1");
  qs.set("fields[0]", "id");

  const r = await strapiRequest(STRAPI_URL, STRAPI_API_TOKEN, `/api/orders?${qs.toString()}`, { method: "GET" });
  if (!r.res.ok) return null;

  const first = Array.isArray(r.data?.data) ? r.data.data[0] : null;
  const id = first?.id;
  return typeof id === "number" ? id : null;
}

async function bestEffortUpdateStripeSessionId(args: {
  STRAPI_URL: string;
  STRAPI_API_TOKEN: string;
  orderId: number | null;
  documentId: string | null;
  stripeSessionId: string;
  orderRef: string;
}) {
  const { STRAPI_URL, STRAPI_API_TOKEN, orderId, documentId, stripeSessionId, orderRef } = args;
  const payload = { data: { stripeSessionId, stripeClientRef: orderRef } };

  if (orderId) {
    try {
      await strapiRequest(STRAPI_URL, STRAPI_API_TOKEN, `/api/orders/${encodeURIComponent(String(orderId))}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      return;
    } catch {}
  }

  if (documentId) {
    try {
      const numericId = await findNumericOrderIdByDocumentId({ STRAPI_URL, STRAPI_API_TOKEN, documentId });
      if (numericId) {
        await strapiRequest(STRAPI_URL, STRAPI_API_TOKEN, `/api/orders/${encodeURIComponent(String(numericId))}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }
    } catch {}
  }
}

/* ---------------- ✅ Custom pricing: Cialde ---------------- */

const CIALDE_PRICE_MAJOR = {
  ostia: 4.75,
  pasta_di_zucchero: 6.5,
} as const;

type CialdaMaterial = keyof typeof CIALDE_PRICE_MAJOR;

function isCialdaMaterial(x: any): x is CialdaMaterial {
  return x === "ostia" || x === "pasta_di_zucchero";
}

function isCialdaItem(it: CartItem) {
  const kind = toSafeString(it?.meta?.kind);
  return kind === "cialda-personalizzata" || kind === "cialde-personalizzate";
}

function buildCialdaName(meta?: CartItemMeta) {
  const m = toSafeString(meta?.material);
  if (m === "pasta_di_zucchero") return "Cialda personalizzata (Pasta di zucchero)";
  if (m === "ostia") return "Cialda personalizzata (Ostia)";
  return "Cialda personalizzata";
}

function compactStripeMeta(meta?: CartItemMeta) {
  if (!meta) return {};
  const out: Record<string, string> = {};

  const shape = toSafeString(meta.shape);
  const material = toSafeString(meta.material);
  const text = toSafeString(meta.text);
  const imageUrl = toSafeString(meta.imageUrl);
  const href = toSafeString(meta.href);

  if (shape) out.shape = shape.slice(0, 80);
  if (material) out.material = material.slice(0, 80);
  if (text) out.text = text.slice(0, 120);
  if (href) out.href = href.slice(0, 200);
  if (imageUrl) out.imageUrl = imageUrl.slice(0, 200);

  return out;
}

/* ---------------- ✅ Server pricing: prodotti + B2B + SKU ---------------- */

type StrapiProduct = {
  id: number | null;
  documentId: string | null;
  slug: string | null;
  name: string | null;

  price: number | null;
  compareAtPrice: number | null;

  companyPrice: number | null;
  b2bPrice: number | null;
  priceAziende: number | null;
  priceCompany: number | null;
  priceB2B: number | null;

  aziendaDiscountEligible: boolean;
  sku: string | null;
};

function toNumOrNull(v: any): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function pickSkuFromStrapiRow(row: any): string | null {
  const a = row?.attributes ?? row ?? {};
  const direct = typeof a?.sku === "string" ? a.sku : typeof row?.sku === "string" ? row.sku : null;
  if (direct && direct.trim()) return direct.trim();

  const variants = a?.variants?.data ?? a?.variants ?? null;
  if (Array.isArray(variants) && variants.length) {
    const v0 = variants[0];
    const va = v0?.attributes ?? v0 ?? {};
    const sku = typeof va?.sku === "string" ? va.sku : typeof v0?.sku === "string" ? v0.sku : null;
    if (sku && sku.trim()) return sku.trim();
  }

  const variant = a?.variant?.data ?? a?.variant ?? null;
  if (variant) {
    const va = variant?.attributes ?? variant ?? {};
    const sku = typeof va?.sku === "string" ? va.sku : typeof variant?.sku === "string" ? variant.sku : null;
    if (sku && sku.trim()) return sku.trim();
  }

  return null;
}

function extractProduct(row: any): StrapiProduct {
  const a = row?.attributes ?? row ?? {};
  const id = typeof row?.id === "number" ? row.id : typeof a?.id === "number" ? a.id : null;

  const documentId =
    typeof row?.documentId === "string" ? row.documentId : typeof a?.documentId === "string" ? a.documentId : null;

  const slug = typeof a?.slug === "string" ? a.slug : typeof row?.slug === "string" ? row.slug : null;
  const name = typeof a?.name === "string" ? a.name : typeof row?.name === "string" ? row.name : null;

  const price = toNumOrNull(a?.price ?? row?.price);
  const compareAtPrice = toNumOrNull(a?.compareAtPrice ?? row?.compareAtPrice);

  const companyPrice = toNumOrNull(a?.companyPrice ?? row?.companyPrice);
  const b2bPrice = toNumOrNull(a?.b2bPrice ?? row?.b2bPrice);
  const priceAziende = toNumOrNull(a?.priceAziende ?? row?.priceAziende);
  const priceCompany = toNumOrNull(a?.price_company ?? row?.price_company ?? a?.priceCompany ?? row?.priceCompany);
  const priceB2B = toNumOrNull(a?.price_b2b ?? row?.price_b2b ?? a?.priceB2B ?? row?.priceB2B);

  const eligibleRaw =
    a?.aziendaDiscountEligible ??
    row?.aziendaDiscountEligible ??
    a?.companyDiscountEligible ??
    row?.companyDiscountEligible ??
    false;

  const sku = pickSkuFromStrapiRow(row);

  return {
    id,
    documentId,
    slug: slug ? String(slug) : null,
    name: name ? String(name) : null,
    price,
    compareAtPrice,
    companyPrice,
    b2bPrice,
    priceAziende,
    priceCompany,
    priceB2B,
    aziendaDiscountEligible: Boolean(eligibleRaw),
    sku,
  };
}

function addInFilter(qs: URLSearchParams, field: string, values: (string | number)[]) {
  values.forEach((v, i) => qs.append(`filters[${field}][$in][${i}]`, String(v)));
}

async function fetchProductsByIdsOrSlugs(args: {
  STRAPI_URL: string;
  STRAPI_API_TOKEN: string;
  ids: number[];
  slugs: string[];
}) {
  const { STRAPI_URL, STRAPI_API_TOKEN, ids, slugs } = args;

  const qs = new URLSearchParams();
  qs.set("pagination[pageSize]", "100");
  if (ids.length > 0) addInFilter(qs, "id", ids);
  if (slugs.length > 0) addInFilter(qs, "slug", slugs);

  const qs1 = new URLSearchParams(qs.toString());
  const fields = [
    "name",
    "slug",
    "price",
    "compareAtPrice",
    "documentId",
    "aziendaDiscountEligible",
    "companyPrice",
    "b2bPrice",
    "priceAziende",
    "priceCompany",
    "priceB2B",
    "price_company",
    "price_b2b",
    "sku",
  ];
  fields.forEach((f, i) => qs1.append(`fields[${i}]`, f));

  qs1.append("populate[variants][fields][0]", "sku");
  qs1.append("populate[variant][fields][0]", "sku");

  const attempt = async (query: URLSearchParams) =>
    strapiRequest(STRAPI_URL, STRAPI_API_TOKEN, `/api/products?${query.toString()}`, { method: "GET" });

  let r = await attempt(qs1);
  if (!r.res.ok && r.res.status === 400) r = await attempt(qs);

  if (!r.res.ok) return { ok: false as const, status: r.res.status, details: r.data ?? r.text };

  const arr = Array.isArray(r.data?.data) ? r.data.data : [];
  const products = arr.map(extractProduct);

  const byId = new Map<number, StrapiProduct>();
  const bySlug = new Map<string, StrapiProduct>();
  for (const p of products) {
    if (typeof p.id === "number") byId.set(p.id, p);
    if (p.slug) bySlug.set(p.slug, p);
  }

  return { ok: true as const, byId, bySlug };
}

type CompanyCtx = { discountPercent: number; approved: boolean };

function clampPercent(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(99, n));
}

async function getCompanyCtx(args: {
  STRAPI_URL: string;
  STRAPI_API_TOKEN: string;
  userId: number | null;
}): Promise<CompanyCtx> {
  const { STRAPI_URL, STRAPI_API_TOKEN, userId } = args;
  if (!userId) return { discountPercent: 0, approved: false };

  const tryQuery = async (userField: "user" | "users") => {
    const qs = new URLSearchParams();
    qs.set("pagination[pageSize]", "1");
    qs.set(`filters[${userField}][id][$eq]`, String(userId));
    qs.append("populate[0]", "aziende");
    qs.append("populate[1]", "azienda");
    qs.append("fields[0]", "customerType");

    const r = await strapiRequest(STRAPI_URL, STRAPI_API_TOKEN, `/api/customer-profiles?${qs.toString()}`, {
      method: "GET",
    });
    if (!r.res.ok) return null;

    const first = Array.isArray(r.data?.data) ? r.data.data[0] : null;
    if (!first) return null;

    const a = first?.attributes ?? first ?? {};
    const customerType = String(a?.customerType ?? "").toUpperCase();
    if (customerType !== "AZIENDE") return { discountPercent: 0, approved: false };

    const rel = a?.aziende?.data ?? a?.azienda?.data ?? a?.aziende ?? a?.azienda ?? null;
    const company = Array.isArray(rel) ? rel[0] : rel;
    const ca = company?.attributes ?? company ?? {};

    const approved = Boolean(ca?.isApproved);
    const percent = clampPercent(ca?.discountPercent);

    if (!approved) return { discountPercent: 0, approved: false };
    return { discountPercent: percent > 0 ? percent : 0, approved: true };
  };

  return (await tryQuery("user")) || (await tryQuery("users")) || { discountPercent: 0, approved: false };
}

function pickCompanyUnitPriceMajor(p: StrapiProduct): number | null {
  const candidates = [p.companyPrice, p.b2bPrice, p.priceAziende, p.priceCompany, p.priceB2B].filter(
    (x) => typeof x === "number" && Number.isFinite(x) && x > 0
  ) as number[];
  return candidates.length ? candidates[0] : null;
}

/* ---------------- ✅ INVENTORY CHECK ---------------- */

async function checkInventoryOrThrow(args: {
  items: Array<{ sku: string; qty: number; name: string }>;
  warehouse: string;
}) {
  const { items, warehouse } = args;
  if (!items.length) return;

  const need = new Map<string, { qty: number; name: string }>();
  for (const it of items) {
    const sku = String(it.sku || "").trim();
    if (!sku) continue;
    const qty = Math.max(1, Math.floor(Number(it.qty) || 1));
    const prev = need.get(sku);
    need.set(sku, { qty: (prev?.qty ?? 0) + qty, name: prev?.name ?? it.name });
  }

  const skus = Array.from(need.keys());
  if (!skus.length) return;

  // ✅ lazy import (build-safe se mancano ENV in inventory.server)
  const { getAvailability } = await import("@/lib/inventory.server");

  const availability = await getAvailability({ skus, warehouse });
  const insufficient: Array<{ sku: string; requested: number; available: number; name: string }> = [];

  for (const sku of skus) {
    const requested = need.get(sku)!.qty;
    const name = need.get(sku)!.name;
    const row = (availability as any)?.data?.[warehouse]?.[sku] ?? null;
    const available = row ? Number(row.available ?? 0) : 0;

    if (!Number.isFinite(available) || available < requested) {
      insufficient.push({ sku, requested, available: Number.isFinite(available) ? available : 0, name });
    }
  }

  if (insufficient.length) {
    const msg = insufficient.length === 1 ? "Prodotto non disponibile" : "Alcuni prodotti non sono disponibili";
    const e: any = new Error(msg);
    e.code = "OUT_OF_STOCK";
    e.details = insufficient;
    throw e;
  }
}

// ---------- POST ----------
export async function POST(request: Request) {
  try {
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
    const STRAPI_URL = process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "";
    const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || "";
    const SITE_URL_RAW = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    // ✅ env check SOLO qui (mai a top-level)
    if (!STRIPE_SECRET_KEY) return jsonNoStore({ ok: false, error: "Server misconfigured" }, 500);
    if (!STRIPE_SECRET_KEY.startsWith("sk_")) return jsonNoStore({ ok: false, error: "Server misconfigured" }, 500);
    if (!STRAPI_URL) return jsonNoStore({ ok: false, error: "Server misconfigured" }, 500);
    if (!STRAPI_API_TOKEN || STRAPI_API_TOKEN.length < 20) return jsonNoStore({ ok: false, error: "Server misconfigured" }, 500);

    let SITE_URL: string;
    try {
      SITE_URL = normalizeSiteUrl(SITE_URL_RAW);
    } catch {
      return jsonNoStore({ ok: false, error: "Server misconfigured" }, 500);
    }

    const { body, raw } = await readBodySafe(request);
    if (!body) {
      const debug = process.env.NODE_ENV === "development" ? { raw: raw?.slice(0, 600) } : undefined;
      return jsonNoStore({ ok: false, error: "Invalid JSON body", ...(debug ? { debug } : {}) }, 400);
    }

    const itemsIn = normalizeItems(body?.items);
    if (itemsIn.length === 0) return jsonNoStore({ ok: false, error: "Cart is empty or invalid items[]" }, 400);
    if (itemsIn.length > 100) return jsonNoStore({ ok: false, error: "Too many items (max 100)" }, 400);

    const billingType: BillingType = normalizeBillingType(body?.billingType);
    const billingSnapshot = normalizeBillingSnapshot(body?.billingSnapshot, billingType);
    if (billingType === "AZIENDE") {
      const err = validateCompanySnapshot(billingSnapshot);
      if (err) return jsonNoStore({ ok: false, error: err }, 400);
    }

    const currency = normalizeCurrency(body?.currency);

    const cookieHeader = request.headers.get("cookie") || "";
    const userJwt = getCookieValue(cookieHeader, "tf_token") || getCookieValue(cookieHeader, "jwtToken");

    let userId: number | null = null;
    let userEmail: string | null = null;

    if (userJwt) {
      try {
        const meRes = await fetchWithRetry(
          `${strapiBaseUrl(STRAPI_URL)}/api/users/me`,
          { headers: { Authorization: `Bearer ${userJwt}`, Accept: "application/json" } },
          15_000
        );

        if (meRes.ok) {
          const me = safeJsonParse(await meRes.text().catch(() => ""));
          if (typeof me?.id === "number") userId = me.id;
          if (typeof me?.email === "string") userEmail = me.email;
        }
      } catch {}
    }

    const companyCtx = await getCompanyCtx({ STRAPI_URL, STRAPI_API_TOKEN, userId });
    const isCompanyUser = companyCtx.approved === true;

    const customItems = itemsIn.filter((it) => isCialdaItem(it));
    const strapiItems = itemsIn.filter((it) => !isCialdaItem(it));

    const ids = Array.from(
      new Set(
        strapiItems
          .map((x) => (typeof x.productId === "number" ? x.productId : typeof x.id === "number" ? x.id : null))
          .filter((n): n is number => typeof n === "number")
      )
    );

    const slugs = strapiItems
      .map((x) => x.slug)
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0);

    const prodRes =
      ids.length || slugs.length
        ? await fetchProductsByIdsOrSlugs({ STRAPI_URL, STRAPI_API_TOKEN, ids, slugs })
        : { ok: true as const, byId: new Map<number, StrapiProduct>(), bySlug: new Map<string, StrapiProduct>() };

    if (!(prodRes as any).ok) {
      return jsonNoStore({ ok: false, error: "Failed fetching products from Strapi" }, 502);
    }

    // ✅ inventory pre-check
    {
      const invItems: Array<{ sku: string; qty: number; name: string }> = [];

      for (const it of strapiItems) {
        const p =
          (typeof it.productId === "number" ? (prodRes as any).byId.get(it.productId) : undefined) ||
          (typeof it.id === "number" ? (prodRes as any).byId.get(it.id) : undefined) ||
          (it.slug ? (prodRes as any).bySlug.get(it.slug) : undefined) ||
          null;

        if (!p) continue;
        if (p.sku) invItems.push({ sku: p.sku, qty: it.qty, name: p.name ?? it.name ?? "Prodotto" });
      }

      try {
        await checkInventoryOrThrow({ items: invItems, warehouse: "MAIN" });
      } catch (e: any) {
        if (e?.code === "OUT_OF_STOCK") {
          return jsonNoStore(
            { ok: false, error: "OUT_OF_STOCK", message: "Quantità non disponibile.", items: e?.details ?? [] },
            409
          );
        }
        throw e;
      }
    }

    // ✅ pricing
    let baseSubtotalMinor = 0;
    let finalSubtotalMinor = 0;

    const pricedItems: Array<{
      productId: number | null;
      slug: string | null;
      name: string;
      qty: number;
      price: number;
      basePrice: number;
      isOnSale: boolean;
      companyPricingApplied: boolean;
      companyPriceUsed: boolean;
      companyDiscountPercentApplied: number;
      variantId: number | null;
      imageUrl: string | null;
      meta?: CartItemMeta;
      sku?: string | null;
    }> = [];

    for (const it of strapiItems) {
      const p =
        (typeof it.productId === "number" ? (prodRes as any).byId.get(it.productId) : undefined) ||
        (typeof it.id === "number" ? (prodRes as any).byId.get(it.id) : undefined) ||
        (it.slug ? (prodRes as any).bySlug.get(it.slug) : undefined) ||
        null;

      if (!p || !p.price || p.price <= 0) {
        throw new Error(`Product not found or invalid price (id=${String(it.productId ?? it.id)} slug=${String(it.slug)})`);
      }

      const publicPriceMajor = p.price;
      const compareAtMajor =
        typeof p.compareAtPrice === "number" && p.compareAtPrice > publicPriceMajor ? p.compareAtPrice : null;

      const baseUnitMajor = compareAtMajor ?? publicPriceMajor;
      const isOnSale = !!compareAtMajor;

      let finalUnitMajor = publicPriceMajor;

      let companyPricingApplied = false;
      let companyPriceUsed = false;
      let companyDiscountPercentApplied = 0;

      if (isCompanyUser) {
        const b2b = pickCompanyUnitPriceMajor(p);
        if (typeof b2b === "number" && b2b > 0) {
          finalUnitMajor = b2b;
          companyPricingApplied = true;
          companyPriceUsed = true;
        } else if (companyCtx.discountPercent > 0 && p.aziendaDiscountEligible === true) {
          const percent = companyCtx.discountPercent;
          const discounted = (publicPriceMajor * (100 - percent)) / 100;
          if (Number.isFinite(discounted) && discounted > 0) {
            finalUnitMajor = discounted;
            companyPricingApplied = true;
            companyDiscountPercentApplied = percent;
          }
        }
      }

      const baseUnitMinor = toStripeUnitAmount(baseUnitMajor, currency);
      const finalUnitMinor = toStripeUnitAmount(finalUnitMajor, currency);
      if (!baseUnitMinor || baseUnitMinor < 1) throw new Error(`Invalid base unit for "${p.name ?? it.name ?? "item"}"`);
      if (!finalUnitMinor || finalUnitMinor < 1) throw new Error(`Invalid final unit for "${p.name ?? it.name ?? "item"}"`);

      baseSubtotalMinor += baseUnitMinor * it.qty;
      finalSubtotalMinor += finalUnitMinor * it.qty;

      pricedItems.push({
        productId: p.id ?? null,
        slug: p.slug ?? it.slug ?? null,
        name: p.name ?? it.name ?? "Articolo",
        qty: it.qty,
        price: toMajor(finalUnitMinor, currency),
        basePrice: toMajor(baseUnitMinor, currency),
        isOnSale,
        companyPricingApplied,
        companyPriceUsed,
        companyDiscountPercentApplied,
        variantId: it.variantId ?? null,
        imageUrl: it.imageUrl ?? null,
        meta: it.meta,
        sku: p.sku ?? null,
      });
    }

    for (const it of customItems) {
      const material = toSafeString(it?.meta?.material);
      if (!isCialdaMaterial(material)) throw new Error(`Cialda: material non valido`);

      const unitMajor = CIALDE_PRICE_MAJOR[material];
      const unitMinor = toStripeUnitAmount(unitMajor, currency);
      if (!unitMinor || unitMinor < 1) throw new Error("Cialda: prezzo non valido");

      baseSubtotalMinor += unitMinor * it.qty;
      finalSubtotalMinor += unitMinor * it.qty;

      const safeMeta = sanitizeMeta(it.meta) ?? undefined;

      pricedItems.push({
        productId: null,
        slug: null,
        name: buildCialdaName(safeMeta),
        qty: it.qty,
        price: toMajor(unitMinor, currency),
        basePrice: toMajor(unitMinor, currency),
        isOnSale: false,
        companyPricingApplied: false,
        companyPriceUsed: false,
        companyDiscountPercentApplied: 0,
        variantId: it.variantId ?? null,
        imageUrl: (safeMeta?.imageUrl as string) ?? it.imageUrl ?? null,
        meta: safeMeta,
      });
    }

    const discountMinor = Math.max(0, baseSubtotalMinor - finalSubtotalMinor);

    const shippingMajorIn = Math.max(0, clampNumber(body?.shippingTotal, 0));
    const shippingMinor = shippingMajorIn > 0 ? toStripeUnitAmount(shippingMajorIn, currency) ?? 0 : 0;

    const totalMinor = finalSubtotalMinor + shippingMinor;
    if (!Number.isFinite(totalMinor) || totalMinor <= 0) return jsonNoStore({ ok: false, error: "Total must be > 0" }, 400);

    const subtotal = toMajor(baseSubtotalMinor, currency);
    const discountTotal = toMajor(discountMinor, currency);
    const shippingTotal = toMajor(shippingMinor, currency);
    const total = toMajor(totalMinor, currency);

    const stripe = new Stripe(STRIPE_SECRET_KEY);

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = pricedItems.map((it) => {
      const unit_amount = toStripeUnitAmount(Number(it.price), currency);
      if (!unit_amount || unit_amount < 1) throw new Error(`Invalid unit_amount for "${it.name}"`);

      const images: string[] = [];
      const img = toSafeString(it.imageUrl);
      if (img && /^https?:\/\//i.test(img)) images.push(img);

      const maybeText = toSafeString(it.meta?.text);
      const name =
        maybeText &&
        maybeText.length <= 40 &&
        (it.meta?.kind === "cialda-personalizzata" || it.meta?.kind === "cialde-personalizzate")
          ? `${it.name} – “${maybeText}”`
          : it.name;

      return {
        quantity: it.qty,
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount,
          product_data: { name, ...(images.length ? { images } : {}) },
        },
      };
    });

    if (shippingMinor > 0) {
      line_items.push({
        quantity: 1,
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount: shippingMinor,
          product_data: { name: "Spedizione" },
        },
      });
    }

    const orderPayload = {
      data: {
        orderStatus: "PENDING_PAYMENT",
        items: pricedItems,
        subtotal,
        discountTotal,
        shippingTotal,
        total,
        currency,
        customerEmail: body?.customerEmail || userEmail || null,
        billingType,
        billingSnapshot,
        ...(userId ? { user: userId } : {}),
      },
    };

    const orderCreate = await strapiRequest(STRAPI_URL, STRAPI_API_TOKEN, "/api/orders", {
      method: "POST",
      body: JSON.stringify(orderPayload),
    });

    if (!orderCreate.res.ok) {
      const details =
        process.env.NODE_ENV === "development"
          ? orderCreate.data ?? { raw: orderCreate.text?.slice(0, 2500) }
          : undefined;

      return jsonNoStore(
        {
          ok: false,
          error: "Order create failed on Strapi",
          status: orderCreate.res.status,
          ...(details ? { details } : {}),
        },
        502
      );
    }

    const { orderId, documentId } = extractOrderRefs(orderCreate.data);
    const orderRef = String(documentId || orderId || "").trim();
    if (!orderRef) return jsonNoStore({ ok: false, error: "Order created but missing id/documentId" }, 500);

    const hasCialda = pricedItems.some(
      (x) => x.meta && (x.meta.kind === "cialda-personalizzata" || x.meta.kind === "cialde-personalizzate")
    );

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        line_items,
        success_url: `${SITE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${SITE_URL}/checkout/cancel`,
        customer_email: body?.customerEmail || userEmail || undefined,
        client_reference_id: orderRef,
        metadata: {
          orderRef,
          orderId: orderId ? String(orderId) : "",
          userId: userId ? String(userId) : "",
          billingType,
          isCompanyUser: isCompanyUser ? "1" : "0",
          ...(hasCialda
            ? (() => {
                const first = pricedItems.find(
                  (x) => x.meta && (x.meta.kind === "cialda-personalizzata" || x.meta.kind === "cialde-personalizzate")
                );
                const compact = compactStripeMeta(first?.meta);
                const out: Record<string, string> = {};
                for (const k of Object.keys(compact)) out[`cialda_${k}`] = compact[k];
                return out;
              })()
            : {}),
        },
      },
      { idempotencyKey: `checkout_${orderRef}` }
    );

    await bestEffortUpdateStripeSessionId({
      STRAPI_URL,
      STRAPI_API_TOKEN,
      orderId,
      documentId,
      stripeSessionId: session.id,
      orderRef,
    });

    return jsonNoStore(
      {
        ok: true,
        url: session.url,
        sessionId: session.id,
        orderRef,
        totals: { subtotal, discountTotal, shippingTotal, total, currency },
        companyPricingApplied: isCompanyUser && pricedItems.some((x) => x.companyPricingApplied),
      },
      200
    );
  } catch (err: any) {
    if (err?.code === "OUT_OF_STOCK") {
      return jsonNoStore({ ok: false, error: "OUT_OF_STOCK", message: err?.message, items: err?.details ?? [] }, 409);
    }

    if (isRetryableFetchError(err)) {
      return jsonNoStore(
        { ok: false, error: "STRAPI_TIMEOUT", message: "Connessione troppo lenta. Riprova tra pochi secondi." },
        504
      );
    }

    console.error("[checkout/start] UNHANDLED:", err);
    return jsonNoStore(
      {
        ok: false,
        error: "Unhandled error",
        ...(process.env.NODE_ENV === "development" ? { details: err?.message ?? String(err) } : {}),
      },
      500
    );
  }
}
