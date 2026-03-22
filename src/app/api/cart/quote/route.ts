import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CartItemMeta = Record<string, any>;

type CartItem = {
  lineId?: string;
  productId?: number;
  id?: number;
  slug?: string;
  qty: number;
  imageUrl?: string;
  meta?: CartItemMeta;
};

type ApiBody = {
  items?: any;
  currency?: string;
  shippingTotal?: number;
};

const FREE_SHIPPING_THRESHOLD_MAJOR_EUR = 79;

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "x-cart-quote": "v5-robust-free-shipping" },
  });
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
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

function strapiBaseUrl(raw: string) {
  return String(raw || "").replace(/\/+$/, "");
}

const STRAPI_TIMEOUT_MS = (() => {
  const n = Number(process.env.STRAPI_TIMEOUT_MS || 30_000);
  return Number.isFinite(n) ? Math.max(8000, n) : 30_000;
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

async function fetchWithTimeout(url: string, init: RequestInit, ms = STRAPI_TIMEOUT_MS) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function fetchWithRetry(url: string, init: RequestInit, ms = STRAPI_TIMEOUT_MS) {
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

function toIntStrict(v: any): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const s = v.trim();
    if (!/^\d+$/.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  return null;
}

function normalizeCurrency(input: any) {
  const cur = String(input || "EUR").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(cur)) return "EUR";
  return cur;
}

function isZeroDecimalCurrency(currency: string) {
  const zero = new Set([
    "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
  ]);
  return zero.has(String(currency || "").toUpperCase());
}

function toMinor(priceMajor: number, currency: string) {
  if (!Number.isFinite(priceMajor) || priceMajor <= 0) return null;
  if (isZeroDecimalCurrency(currency)) return Math.round(priceMajor);
  return Math.round(priceMajor * 100);
}

function toMajor(amountMinor: number, currency: string) {
  if (isZeroDecimalCurrency(currency)) return amountMinor;
  return amountMinor / 100;
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

    const productId = toIntStrict(it?.productId) ?? undefined;
    const id = toIntStrict(it?.id) ?? undefined;

    const slug =
      typeof it?.slug === "string" && it.slug.trim()
        ? it.slug.trim()
        : typeof it?.productSlug === "string" && it.productSlug.trim()
        ? it.productSlug.trim()
        : undefined;

    const lineId = typeof it?.lineId === "string" ? it.lineId : undefined;

    const meta = sanitizeMeta(it?.meta);
    const isCustom = typeof meta?.kind === "string" && meta.kind.trim().length > 0;

    if (!productId && !id && !slug && !isCustom) continue;

    out.push({
      lineId,
      productId,
      id,
      slug,
      qty,
      imageUrl: typeof it?.imageUrl === "string" ? it.imageUrl : undefined,
      meta,
    });
  }

  return out;
}

const CIALDE_PRICE_MAJOR = {
  ostia: 4.75,
  pasta_di_zucchero: 6.5,
} as const;

type CialdaMaterial = keyof typeof CIALDE_PRICE_MAJOR;

function isCialdaItem(it: CartItem) {
  const kind = String(it?.meta?.kind ?? "").trim();
  return kind === "cialda-personalizzata" || kind === "cialde-personalizzate";
}

function isCialdaMaterial(x: any): x is CialdaMaterial {
  return x === "ostia" || x === "pasta_di_zucchero";
}

function buildCialdaName(meta?: CartItemMeta) {
  const m = String(meta?.material ?? "").trim();
  if (m === "pasta_di_zucchero") return "Cialda personalizzata (Pasta di zucchero)";
  if (m === "ostia") return "Cialda personalizzata (Ostia)";
  return "Cialda personalizzata";
}

type StrapiProduct = {
  id: number | null;
  slug: string | null;
  name: string | null;
  price: number | null;
  compareAtPrice: number | null;
  companyPrice: number | null;
  aziendaDiscountEligible: boolean;
};

function toNumOrNull(v: any): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function extractProduct(row: any): StrapiProduct {
  const a = row?.attributes ?? row ?? {};
  const id = typeof row?.id === "number" ? row.id : null;
  const slug = typeof a?.slug === "string" ? a.slug : typeof row?.slug === "string" ? row.slug : null;
  const name = typeof a?.name === "string" ? a.name : typeof row?.name === "string" ? row.name : null;

  const price = toNumOrNull(a?.price ?? row?.price);
  const compareAtPrice = toNumOrNull(a?.compareAtPrice ?? row?.compareAtPrice);
  const companyPrice = toNumOrNull(a?.companyPrice ?? row?.companyPrice);

  const eligibleRaw =
    a?.aziendaDiscountEligible ??
    row?.aziendaDiscountEligible ??
    a?.companyDiscountEligible ??
    row?.companyDiscountEligible ??
    false;

  return {
    id,
    slug: slug ? String(slug) : null,
    name: name ? String(name) : null,
    price,
    compareAtPrice,
    companyPrice,
    aziendaDiscountEligible: Boolean(eligibleRaw),
  };
}

function addInFilter(qs: URLSearchParams, field: string, values: (string | number)[]) {
  values.forEach((v) => qs.append(`filters[${field}][$in]`, String(v)));
}

async function strapiRequest(STRAPI_URL: string, STRAPI_API_TOKEN: string, path: string, init: RequestInit) {
  const res = await fetchWithRetry(`${strapiBaseUrl(STRAPI_URL)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const text = await res.text().catch(() => "");
  const data = text ? safeJsonParse(text) : null;
  return { res, data, text };
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
  if (ids.length) addInFilter(qs, "id", ids);
  if (slugs.length) addInFilter(qs, "slug", slugs);

  const qs1 = new URLSearchParams(qs.toString());
  ["name", "slug", "price", "compareAtPrice", "companyPrice", "aziendaDiscountEligible"].forEach((f, i) => {
    qs1.append(`fields[${i}]`, f);
  });

  let r = await strapiRequest(STRAPI_URL, STRAPI_API_TOKEN, `/api/products?${qs1.toString()}`, { method: "GET" });

  if (!r.res.ok && r.res.status === 400) {
    r = await strapiRequest(STRAPI_URL, STRAPI_API_TOKEN, `/api/products?${qs.toString()}`, { method: "GET" });
  }

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

type CompanyCtx = { approved: boolean; discountPercent: number };

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
  if (!userId) return { approved: false, discountPercent: 0 };

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
    if (customerType !== "AZIENDE") return { approved: false, discountPercent: 0 };

    const rel = a?.aziende?.data ?? a?.azienda?.data ?? a?.aziende ?? a?.azienda ?? null;
    const company = Array.isArray(rel) ? rel[0] : rel;
    const ca = company?.attributes ?? company ?? {};

    const approved = Boolean(ca?.isApproved);
    const percent = clampPercent(ca?.discountPercent);

    if (!approved) return { approved: false, discountPercent: 0 };
    return { approved: true, discountPercent: percent > 0 ? percent : 0 };
  };

  return (await tryQuery("user")) || (await tryQuery("users")) || { approved: false, discountPercent: 0 };
}

export async function POST(request: Request) {
  try {
    const STRAPI_URL = process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "";
    const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || "";

    if (!STRAPI_URL) return json({ ok: false, error: "Missing STRAPI_URL" }, 500);
    if (!STRAPI_API_TOKEN || STRAPI_API_TOKEN.length < 20) {
      return json({ ok: false, error: "Missing STRAPI_API_TOKEN" }, 500);
    }

    const { body } = await readBodySafe(request);
    if (!body) return json({ ok: false, error: "Invalid JSON body" }, 400);

    const currency = normalizeCurrency(body.currency);
    const itemsIn = normalizeItems(body.items);
    if (!itemsIn.length) return json({ ok: false, error: "Empty cart" }, 400);

    const cookieHeader = request.headers.get("cookie") || "";
    const userJwt = getCookieValue(cookieHeader, "tf_token") || getCookieValue(cookieHeader, "jwtToken");

    let userId: number | null = null;
    let authenticated = false;

    if (userJwt) {
      try {
        const meRes = await fetchWithRetry(`${strapiBaseUrl(STRAPI_URL)}/api/users/me`, {
          headers: { Authorization: `Bearer ${userJwt}` },
        });
        if (meRes.ok) {
          const me = safeJsonParse(await meRes.text().catch(() => ""));
          if (typeof me?.id === "number") userId = me.id;
          authenticated = true;
        }
      } catch {}
    }

    const companyCtx = await getCompanyCtx({ STRAPI_URL, STRAPI_API_TOKEN, userId }).catch(() => ({
      approved: false,
      discountPercent: 0,
    }));
    const isCompanyUser = companyCtx.approved === true;

    const customItems = itemsIn.filter(isCialdaItem);
    const strapiItems = itemsIn.filter((it) => !isCialdaItem(it));

    const ids = Array.from(
      new Set(
        strapiItems
          .map((x) => x.productId ?? x.id)
          .filter((n): n is number => typeof n === "number")
      )
    );
    const slugs = strapiItems
      .map((x) => x.slug)
      .filter((s): s is string => typeof s === "string" && Boolean(s.trim()));

    const prodRes =
      ids.length || slugs.length
        ? await fetchProductsByIdsOrSlugs({ STRAPI_URL, STRAPI_API_TOKEN, ids, slugs })
        : { ok: true as const, byId: new Map<number, StrapiProduct>(), bySlug: new Map<string, StrapiProduct>() };

    if (!prodRes.ok) {
      return json(
        {
          ok: false,
          error: "STRAPI_FETCH_FAILED",
          message: "Strapi non risponde in tempo o ha restituito un errore.",
          status: (prodRes as any).status,
          details: (prodRes as any).details,
        },
        502
      );
    }

    const missing: Array<{ productId?: number; id?: number; slug?: string }> = [];
    for (const it of strapiItems) {
      const p =
        (typeof it.productId === "number" ? prodRes.byId.get(it.productId) : undefined) ||
        (typeof it.id === "number" ? prodRes.byId.get(it.id) : undefined) ||
        (it.slug ? prodRes.bySlug.get(it.slug) : undefined) ||
        null;

      if (!p) missing.push({ productId: it.productId, id: it.id, slug: it.slug });
    }

    if (missing.length) {
      return json(
        {
          ok: false,
          error: "ITEM_NOT_FOUND",
          message: "Uno o più prodotti del carrello non esistono su Strapi (slug/id non allineati).",
          missing,
        },
        400
      );
    }

    let baseSubtotalMinor = 0;
    let finalSubtotalMinor = 0;

    const pricedItems: any[] = [];

    for (const it of strapiItems) {
      const p =
        (typeof it.productId === "number" ? prodRes.byId.get(it.productId) : undefined) ||
        (typeof it.id === "number" ? prodRes.byId.get(it.id) : undefined) ||
        (it.slug ? prodRes.bySlug.get(it.slug) : undefined) ||
        null;

      if (!p || !p.price || p.price <= 0) {
        return json(
          {
            ok: false,
            error: "INVALID_PRICE",
            message: "Prodotto trovato ma prezzo non valido su Strapi.",
            product: { id: p?.id ?? null, slug: p?.slug ?? it.slug ?? null, name: p?.name ?? null, price: p?.price ?? null },
          },
          400
        );
      }

      const publicPriceMajor = p.price;
      const compareAtMajor =
        typeof p.compareAtPrice === "number" && p.compareAtPrice > publicPriceMajor ? p.compareAtPrice : null;

      const baseUnitMajor = compareAtMajor ?? publicPriceMajor;

      let finalUnitMajor = publicPriceMajor;
      let companyApplied = false;

      if (isCompanyUser && typeof p.companyPrice === "number" && p.companyPrice > 0) {
        finalUnitMajor = p.companyPrice;
        companyApplied = true;
      } else if (isCompanyUser && companyCtx.discountPercent > 0 && p.aziendaDiscountEligible) {
        finalUnitMajor = (publicPriceMajor * (100 - companyCtx.discountPercent)) / 100;
        companyApplied = true;
      }

      const baseUnitMinor = toMinor(baseUnitMajor, currency);
      const finalUnitMinor = toMinor(finalUnitMajor, currency);
      if (!baseUnitMinor || !finalUnitMinor) {
        return json({ ok: false, error: "INVALID_AMOUNT", message: "Prezzo non valido (minor calc)." }, 400);
      }

      baseSubtotalMinor += baseUnitMinor * it.qty;
      finalSubtotalMinor += finalUnitMinor * it.qty;

      pricedItems.push({
        lineId: it.lineId ?? null,
        productId: p.id,
        slug: p.slug,
        name: p.name ?? "Articolo",
        qty: it.qty,
        baseUnitPrice: toMajor(baseUnitMinor, currency),
        unitPrice: toMajor(finalUnitMinor, currency),
        lineTotal: toMajor(finalUnitMinor * it.qty, currency),
        isOnSale: !!compareAtMajor,
        companyApplied,
        imageUrl: it.imageUrl ?? null,
        meta: it.meta,
      });
    }

    for (const it of customItems) {
      const material = String(it?.meta?.material ?? "").trim();
      if (!isCialdaMaterial(material)) {
        return json({ ok: false, error: "INVALID_CIALDA_MATERIAL", message: "Cialda: materiale non valido." }, 400);
      }

      const unitMajor = CIALDE_PRICE_MAJOR[material];
      const unitMinor = toMinor(unitMajor, currency);
      if (!unitMinor) return json({ ok: false, error: "INVALID_CIALDA_PRICE" }, 400);

      baseSubtotalMinor += unitMinor * it.qty;
      finalSubtotalMinor += unitMinor * it.qty;

      pricedItems.push({
        lineId: it.lineId ?? null,
        productId: null,
        slug: null,
        name: buildCialdaName(it.meta),
        qty: it.qty,
        baseUnitPrice: toMajor(unitMinor, currency),
        unitPrice: toMajor(unitMinor, currency),
        lineTotal: toMajor(unitMinor * it.qty, currency),
        isOnSale: false,
        companyApplied: false,
        imageUrl: String(it?.meta?.imageUrl ?? it.imageUrl ?? "") || null,
        meta: sanitizeMeta(it.meta),
      });
    }

    const discountMinor = Math.max(0, baseSubtotalMinor - finalSubtotalMinor);

    const requestedShippingMajor = Math.max(0, clampNumber(body.shippingTotal, 0));
    const freeShippingThresholdMinor = toMinor(FREE_SHIPPING_THRESHOLD_MAJOR_EUR, currency);
    const qualifiesForFreeShipping =
      typeof freeShippingThresholdMinor === "number" && finalSubtotalMinor >= freeShippingThresholdMinor;

    const shippingMinor =
      qualifiesForFreeShipping
        ? 0
        : requestedShippingMajor > 0
          ? toMinor(requestedShippingMajor, currency) ?? 0
          : 0;

    const totalMinor = finalSubtotalMinor + shippingMinor;

    return json({
      ok: true,
      auth: { authenticated, isCompanyUser },
      pricedItems,
      totals: {
        subtotal: toMajor(baseSubtotalMinor, currency),
        discountedSubtotal: toMajor(finalSubtotalMinor, currency),
        discountTotal: toMajor(discountMinor, currency),
        shippingTotal: toMajor(shippingMinor, currency),
        total: toMajor(totalMinor, currency),
        currency,
        freeShippingThreshold: FREE_SHIPPING_THRESHOLD_MAJOR_EUR,
        qualifiesForFreeShipping,
      },
    });
  } catch (e: any) {
    if (isRetryableFetchError(e)) {
      return json(
        {
          ok: false,
          error: "TIMEOUT",
          message: "Aggiornamento prezzi troppo lento (Render). Riprova tra poco.",
          details: e?.message ?? String(e),
        },
        504
      );
    }
    return json({ ok: false, error: e?.message ? String(e.message) : "Quote error" }, 500);
  }
}