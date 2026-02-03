import Stripe from "stripe";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ✅ accettiamo anche slug/id come fallback (il client può mandare uno dei due)
type CartItem = {
  productId?: number; // preferito
  id?: number; // fallback
  slug?: string; // fallback
  name?: string;
  price?: number; // IGNORATO (non fidarti del client)
  qty: number;
  imageUrl?: string;
  variantId?: number | null;
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

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "x-checkout-route": "v9-server-pricing",
    },
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

function normalizeItems(input: any): CartItem[] {
  if (!Array.isArray(input)) return [];
  const out: CartItem[] = [];

  for (const it of input) {
    const qtyRaw = clampNumber(it?.qty, NaN);
    const qty = Number.isFinite(qtyRaw) ? Math.floor(qtyRaw) : NaN;
    if (!Number.isFinite(qty) || qty <= 0) continue;

    const productId =
      typeof it?.productId === "number"
        ? it.productId
        : typeof it?.id === "number"
        ? it.id
        : undefined;

    const slug =
      typeof it?.slug === "string" && it.slug.trim()
        ? it.slug.trim()
        : typeof it?.productSlug === "string" && it.productSlug.trim()
        ? it.productSlug.trim()
        : undefined;

    // serve almeno productId o slug
    if (!productId && !slug) continue;

    out.push({
      productId,
      id: productId,
      slug,
      name: typeof it?.name === "string" ? it.name : undefined,
      qty,
      imageUrl: typeof it?.imageUrl === "string" ? it.imageUrl : undefined,
      variantId: typeof it?.variantId === "number" || it?.variantId === null ? it.variantId : undefined,
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
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
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

async function fetchWithTimeout(url: string, init: RequestInit, ms = 12_000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function strapiRequest(
  STRAPI_URL: string,
  STRAPI_API_TOKEN: string,
  path: string,
  init: RequestInit,
  timeoutMs = 12_000
) {
  const res = await fetchWithTimeout(`${strapiBaseUrl(STRAPI_URL)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  }, timeoutMs);

  const text = await res.text().catch(() => "");
  const data = text ? safeJsonParse(text) : null;
  return { res, text, data };
}

/** Stripe: zero-decimal currencies */
function isZeroDecimalCurrency(currency: string) {
  const zero = new Set([
    "BIF","CLP","DJF","GNF","JPY","KMF","KRW","MGA","PYG","RWF","UGX","VND","VUV","XAF","XOF","XPF",
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

// ---------- ✅ Server pricing: prodotti + sconto aziende ----------

type StrapiProduct = {
  id: number | null;
  documentId: string | null;
  slug: string | null;
  name: string | null;
  price: number | null;
  aziendaDiscountEligible: boolean;
};

function extractProduct(row: any): StrapiProduct {
  const a = row?.attributes ?? row ?? {};
  const id = typeof row?.id === "number" ? row.id : typeof a?.id === "number" ? a.id : null;

  const documentId =
    typeof row?.documentId === "string" ? row.documentId :
    typeof a?.documentId === "string" ? a.documentId : null;

  const slug =
    typeof a?.slug === "string" ? a.slug :
    typeof row?.slug === "string" ? row.slug : null;

  const name =
    typeof a?.name === "string" ? a.name :
    typeof row?.name === "string" ? row.name : null;

  const priceRaw = a?.price ?? row?.price ?? null;
  const price = typeof priceRaw === "number" ? priceRaw : (typeof priceRaw === "string" ? Number(priceRaw) : null);

  const eligibleRaw =
    a?.aziendaDiscountEligible ?? row?.aziendaDiscountEligible ??
    a?.companyDiscountEligible ?? row?.companyDiscountEligible ??
    false;

  return {
    id,
    documentId,
    slug: slug ? String(slug) : null,
    name: name ? String(name) : null,
    price: Number.isFinite(price as any) ? (price as number) : null,
    aziendaDiscountEligible: Boolean(eligibleRaw),
  };
}

function addInFilter(qs: URLSearchParams, field: string, values: (string | number)[]) {
  values.forEach((v, i) => {
    qs.append(`filters[${field}][$in][${i}]`, String(v));
  });
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

  // fields essenziali
  qs.append("fields[0]", "name");
  qs.append("fields[1]", "slug");
  qs.append("fields[2]", "price");
  qs.append("fields[3]", "documentId");
  qs.append("fields[4]", "aziendaDiscountEligible");

  const r = await strapiRequest(STRAPI_URL, STRAPI_API_TOKEN, `/api/products?${qs.toString()}`, { method: "GET" });
  if (!r.res.ok) {
    return { ok: false as const, status: r.res.status, details: r.data ?? r.text };
  }

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

/**
 * Cerca CustomerProfile dell'utente e (se AZIENDE + approvata) ritorna discountPercent.
 * Robusto: prova filters[user] e filters[users] perché il campo può chiamarsi diverso.
 */
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

    // populate azienda/e
    qs.append("populate[0]", "aziende");
    qs.append("populate[1]", "azienda");

    // fields utili
    qs.append("fields[0]", "customerType");

    const r = await strapiRequest(
      STRAPI_URL,
      STRAPI_API_TOKEN,
      `/api/customer-profiles?${qs.toString()}`,
      { method: "GET" }
    );
    if (!r.res.ok) return null;

    const first = Array.isArray(r.data?.data) ? r.data.data[0] : null;
    if (!first) return null;

    const a = first?.attributes ?? first ?? {};
    const customerType = String(a?.customerType ?? "").toUpperCase();

    if (customerType !== "AZIENDE") return { discountPercent: 0, approved: false };

    const rel =
      a?.aziende?.data ?? a?.azienda?.data ?? a?.aziende ?? a?.azienda ?? null;

    const company = Array.isArray(rel) ? rel[0] : rel;
    const ca = company?.attributes ?? company ?? {};

    const approved = Boolean(ca?.isApproved);
    const percent = clampPercent(ca?.discountPercent);

    if (!approved || percent <= 0) return { discountPercent: 0, approved: false };
    return { discountPercent: percent, approved: true };
  };

  // prova entrambi
  const a = await tryQuery("user");
  if (a) return a;
  const b = await tryQuery("users");
  if (b) return b;

  return { discountPercent: 0, approved: false };
}

// ---------- POST ----------
export async function POST(request: Request) {
  try {
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
    const STRAPI_URL = process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "";
    const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || "";
    const SITE_URL_RAW = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    if (!STRIPE_SECRET_KEY) return json({ ok: false, error: "Missing STRIPE_SECRET_KEY" }, 500);
    if (!STRIPE_SECRET_KEY.startsWith("sk_")) return json({ ok: false, error: "STRIPE_SECRET_KEY invalid (must start with sk_)" }, 500);
    if (!STRAPI_URL) return json({ ok: false, error: "Missing STRAPI_URL" }, 500);
    if (!STRAPI_API_TOKEN || STRAPI_API_TOKEN.length < 20) {
      return json({ ok: false, error: "Missing STRAPI_API_TOKEN (Strapi → Settings → API Tokens)" }, 500);
    }

    let SITE_URL: string;
    try {
      SITE_URL = normalizeSiteUrl(SITE_URL_RAW);
    } catch {
      return json({ ok: false, error: "NEXT_PUBLIC_SITE_URL is not a valid URL", value: SITE_URL_RAW }, 500);
    }

    const { body, raw } = await readBodySafe(request);
    if (!body) return json({ ok: false, error: "Invalid JSON body", debug: { raw: raw?.slice(0, 600) } }, 400);

    const itemsIn = normalizeItems(body?.items);
    if (itemsIn.length === 0) {
      return json({ ok: false, error: "Cart is empty or invalid items[] (need productId/id or slug + qty)" }, 400);
    }
    if (itemsIn.length > 100) return json({ ok: false, error: "Too many items (max 100)" }, 400);

    const billingType: BillingType = normalizeBillingType(body?.billingType);
    const billingSnapshot = normalizeBillingSnapshot(body?.billingSnapshot, billingType);
    if (billingType === "AZIENDE") {
      const err = validateCompanySnapshot(billingSnapshot);
      if (err) return json({ ok: false, error: err }, 400);
    }

    const currency = normalizeCurrency(body?.currency);

    // utente (se loggato) -> userId/email
    const cookieHeader = request.headers.get("cookie") || "";
    const userJwt = getCookieValue(cookieHeader, "tf_token") || getCookieValue(cookieHeader, "jwtToken");

    let userId: number | null = null;
    let userEmail: string | null = null;

    if (userJwt) {
      try {
        const meRes = await fetchWithTimeout(`${strapiBaseUrl(STRAPI_URL)}/api/users/me`, {
          headers: { Authorization: `Bearer ${userJwt}` },
        }, 10_000);

        if (meRes.ok) {
          const me = safeJsonParse(await meRes.text().catch(() => ""));
          if (typeof me?.id === "number") userId = me.id;
          if (typeof me?.email === "string") userEmail = me.email;
        }
      } catch {
        // ignore
      }
    }

    // ✅ contesto azienda (server-side)
    const companyCtx = await getCompanyCtx({ STRAPI_URL, STRAPI_API_TOKEN, userId });
    const discountPercent = companyCtx.approved ? companyCtx.discountPercent : 0;

    // ✅ fetch prodotti reali da Strapi
    const ids = Array.from(new Set(itemsIn.map((x) => x.productId ?? x.id).filter((n): n is number => typeof n === "number")));
    const slugs = itemsIn
      .map((x) => x.slug)
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0);


    const prodRes = await fetchProductsByIdsOrSlugs({ STRAPI_URL, STRAPI_API_TOKEN, ids, slugs });
    if (!prodRes.ok) {
      return json({ ok: false, error: "Failed fetching products from Strapi", status: prodRes.status, details: prodRes.details }, 502);
    }

    // ✅ calcolo prezzi in minor per coerenza Stripe
    let baseSubtotalMinor = 0;
    let discountedSubtotalMinor = 0;

    const pricedItems = itemsIn.map((it) => {
      const p =
        (typeof it.productId === "number" ? prodRes.byId.get(it.productId) : undefined) ||
        (typeof it.id === "number" ? prodRes.byId.get(it.id) : undefined) ||
        (it.slug ? prodRes.bySlug.get(it.slug) : undefined) ||
        null;

      if (!p || !p.price || p.price <= 0) {
        throw new Error(`Product not found or invalid price for item (productId=${String(it.productId ?? it.id)} slug=${String(it.slug)})`);
      }

      const baseUnitMinor = toStripeUnitAmount(p.price, currency);
      if (!baseUnitMinor || baseUnitMinor < 1) {
        throw new Error(`Invalid base unit amount for "${p.name ?? it.name ?? "item"}"`);
      }

      const eligible = p.aziendaDiscountEligible === true;
      const appliedPercent = eligible ? discountPercent : 0;

      const discountedUnitMinor =
        appliedPercent > 0
          ? Math.round((baseUnitMinor * (100 - appliedPercent)) / 100)
          : baseUnitMinor;

      if (!discountedUnitMinor || discountedUnitMinor < 1) {
        throw new Error(`Discount too high for "${p.name ?? it.name ?? "item"}" (unit would be < 1)`);
      }

      baseSubtotalMinor += baseUnitMinor * it.qty;
      discountedSubtotalMinor += discountedUnitMinor * it.qty;

      return {
        productId: p.id ?? it.productId ?? it.id ?? null,
        slug: p.slug ?? it.slug ?? null,
        name: p.name ?? it.name ?? "Articolo",
        qty: it.qty,
        // ✅ prezzo finale che il cliente paga (unitario, major)
        price: toMajor(discountedUnitMinor, currency),
        // extra utili in order.items (JSON) senza rompere la UI
        basePrice: toMajor(baseUnitMinor, currency),
        aziendaDiscountEligible: eligible,
        discountPercentApplied: appliedPercent,
        variantId: it.variantId ?? null,
        imageUrl: it.imageUrl ?? null,
      };
    });

    const discountMinor = Math.max(0, baseSubtotalMinor - discountedSubtotalMinor);

    // spedizione (se >0 la mettiamo anche in Stripe come line item)
    const shippingMajorIn = Math.max(0, clampNumber(body?.shippingTotal, 0));
    const shippingMinor = shippingMajorIn > 0 ? (toStripeUnitAmount(shippingMajorIn, currency) ?? 0) : 0;

    const totalMinor = discountedSubtotalMinor + shippingMinor;
    if (!Number.isFinite(totalMinor) || totalMinor <= 0) {
      return json({ ok: false, error: "Total must be > 0" }, 400);
    }

    const subtotal = toMajor(baseSubtotalMinor, currency);
    const discountTotal = toMajor(discountMinor, currency);
    const shippingTotal = toMajor(shippingMinor, currency);
    const total = toMajor(totalMinor, currency);

    // ✅ Stripe line items coerenti (sconto già applicato sui prezzi)
    const stripe = new Stripe(STRIPE_SECRET_KEY);

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = pricedItems.map((it) => {
      const unit_amount = toStripeUnitAmount(Number(it.price), currency);
      if (!unit_amount || unit_amount < 1) throw new Error(`Invalid unit_amount for "${it.name}"`);
      return {
        quantity: it.qty,
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount,
          product_data: { name: it.name },
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

    // 1) crea ordine su Strapi
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
      return json(
        {
          ok: false,
          error: "Order create failed on Strapi",
          status: orderCreate.res.status,
          details: orderCreate.data ?? { raw: orderCreate.text?.slice(0, 2500) },
        },
        orderCreate.res.status
      );
    }

    const { orderId, documentId } = extractOrderRefs(orderCreate.data);
    const orderRef = String(documentId || orderId || "").trim();

    if (!orderRef) {
      return json({ ok: false, error: "Order created but missing id/documentId", details: orderCreate.data }, 500);
    }

    // 2) crea session Stripe
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
          // utile per debug
          companyDiscountPercent: discountPercent ? String(discountPercent) : "0",
        },
      },
      { idempotencyKey: `checkout_${orderRef}` }
    );

    // 3) salva stripeSessionId su Strapi
    await bestEffortUpdateStripeSessionId({
      STRAPI_URL,
      STRAPI_API_TOKEN,
      orderId,
      documentId,
      stripeSessionId: session.id,
      orderRef,
    });

    return json(
      {
        ok: true,
        url: session.url,
        sessionId: session.id,
        orderRef,
        totals: { subtotal, discountTotal, shippingTotal, total, currency },
        companyDiscountApplied: discountPercent > 0,
        companyDiscountPercent: discountPercent,
      },
      200
    );
  } catch (err: any) {
    console.error("[checkout/start] UNHANDLED:", err);
    return json({ ok: false, error: "Unhandled error", details: err?.message ?? String(err) }, 500);
  }
}
