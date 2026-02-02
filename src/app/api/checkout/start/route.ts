import Stripe from "stripe";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CartItem = {
  productId?: number;
  name: string;
  price: number; // major currency (es: 9.99 EUR)
  qty: number;
  imageUrl?: string;
  variantId?: number | null;
};

type BillingType = "PRIVATE" | "AZIENDE";

type ApiBody = {
  items?: any;
  currency?: string;
  discountTotal?: number;
  shippingTotal?: number;
  billingType?: BillingType | string;
  billingSnapshot?: any;
  customerEmail?: string;
  orderRef?: string;
};

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "x-checkout-route": "v8-prod",
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
    const name = String(it?.name || "").trim();
    const price = clampNumber(it?.price, NaN);
    const qtyRaw = clampNumber(it?.qty, NaN);

    const qty = Number.isFinite(qtyRaw) ? Math.floor(qtyRaw) : NaN;

    if (!name) continue;
    if (!Number.isFinite(price) || price <= 0) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;

    out.push({
      productId: typeof it?.productId === "number" ? it.productId : undefined,
      name,
      price,
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

// zero-decimal: niente centesimi -> unit_amount = major
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

/**
 * Estrae id/documentId in modo robusto sia per Strapi v4 che v5.
 * - v4: { data: { id, attributes: { documentId? } } }
 * - v5: { data: { id, documentId } } oppure { id, documentId }
 */
function extractOrderRefs(orderJson: any): { orderId: number | null; documentId: string | null } {
  const root = orderJson?.data ?? orderJson ?? null;
  if (!root) return { orderId: null, documentId: null };

  const id = typeof root?.id === "number" ? root.id : null;
  const doc1 = typeof root?.documentId === "string" ? root.documentId : null;
  const doc2 = typeof root?.attributes?.documentId === "string" ? root.attributes.documentId : null;

  return { orderId: id, documentId: doc1 || doc2 || null };
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

  const payload = {
    data: {
      stripeSessionId,
      stripeClientRef: orderRef,
    },
  };

  // 1) update con ID numerico (modo “ufficiale” REST Strapi)
  if (orderId) {
    try {
      await strapiRequest(STRAPI_URL, STRAPI_API_TOKEN, `/api/orders/${encodeURIComponent(String(orderId))}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      return;
    } catch {
      // ignore
    }
  }

  // 2) fallback: se ho solo documentId, prima ricavo id numerico e poi aggiorno
  if (documentId) {
    try {
      const numericId = await findNumericOrderIdByDocumentId({ STRAPI_URL, STRAPI_API_TOKEN, documentId });
      if (numericId) {
        await strapiRequest(STRAPI_URL, STRAPI_API_TOKEN, `/api/orders/${encodeURIComponent(String(numericId))}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }
    } catch {
      // ignore
    }
  }
}

export async function POST(request: Request) {
  try {
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
    const STRAPI_URL = process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "";
    const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || "";
    const SITE_URL_RAW = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    if (!STRIPE_SECRET_KEY) return json({ ok: false, error: "Missing STRIPE_SECRET_KEY" }, 500);
    if (!STRIPE_SECRET_KEY.startsWith("sk_")) {
      return json({ ok: false, error: "STRIPE_SECRET_KEY invalid (must start with sk_)" }, 500);
    }
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
    if (!body) {
      return json({ ok: false, error: "Invalid JSON body", debug: { raw: raw?.slice(0, 600) } }, 400);
    }

    const items = normalizeItems(body?.items);
    if (items.length === 0) {
      return json({ ok: false, error: "Cart is empty or invalid items[]", debug: { raw: raw?.slice(0, 800) } }, 400);
    }
    if (items.length > 100) {
      return json({ ok: false, error: "Too many items (max 100)" }, 400);
    }

    const billingType: BillingType = normalizeBillingType(body?.billingType);
    const billingSnapshot = normalizeBillingSnapshot(body?.billingSnapshot, billingType);

    if (billingType === "AZIENDE") {
      const err = validateCompanySnapshot(billingSnapshot);
      if (err) return json({ ok: false, error: err }, 400);
    }

    const currency = normalizeCurrency(body?.currency);

    const subtotal = items.reduce((sum, it) => sum + it.price * it.qty, 0);
    const discountTotal = Math.max(0, clampNumber(body?.discountTotal, 0));
    const shippingTotal = Math.max(0, clampNumber(body?.shippingTotal, 0));
    const total = Math.max(0, subtotal - discountTotal + shippingTotal);

    // Se un giorno farai coupon 100%: qui decidi la policy.
    // Oggi: se total <= 0, blocchiamo (Stripe richiede importi > 0).
    if (!Number.isFinite(total) || total <= 0) {
      return json(
        { ok: false, error: "Total must be > 0 (discount/shipping invalid or full discount not supported yet)", debug: { subtotal, discountTotal, shippingTotal, total } },
        400
      );
    }

    // utente (se loggato)
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

    const stripe = new Stripe(STRIPE_SECRET_KEY);

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((it) => {
      const unit_amount = toStripeUnitAmount(it.price, currency);
      if (!unit_amount || unit_amount < 1) {
        throw new Error(`Invalid unit_amount for "${it.name}". Got ${String(unit_amount)} (${currency})`);
      }

      return {
        quantity: it.qty,
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount,
          product_data: { name: it.name },
        },
      };
    });

    // 1) crea ordine su Strapi (PENDING_PAYMENT)
    const orderPayload = {
      data: {
        orderStatus: "PENDING_PAYMENT",
        items,
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

        // utile per correlazione (webhook/confirm)
        client_reference_id: orderRef,

        metadata: {
          orderRef,
          orderId: orderId ? String(orderId) : "",
          userId: userId ? String(userId) : "",
          billingType,
        },
      },
      { idempotencyKey: `checkout_${orderRef}` }
    );

    // 3) salva stripeSessionId su Strapi (best effort, robusto)
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
        orderId,
        documentId,
      },
      200
    );
  } catch (err: any) {
    console.error("[checkout/start] UNHANDLED:", err);
    return json({ ok: false, error: "Unhandled error", details: err?.message ?? String(err) }, 500);
  }
}
