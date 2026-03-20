// src/app/api/checkout/verify/route.ts
import Stripe from "stripe";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "x-checkout-verify": "v2",
    },
  });
}

function strapiBaseUrl(raw: string) {
  return String(raw || "").replace(/\/+$/, "");
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function parsePositiveInt(value: unknown) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function getSessionMetadataValue(session: Stripe.Checkout.Session, key: string) {
  const value = session.metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 25_000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
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

async function fetchWithRetry(url: string, init: RequestInit = {}, ms = 25_000) {
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
  timeoutMs = 25_000,
  extraHeaders?: Record<string, string>
) {
  const res = await fetchWithRetry(
    `${strapiBaseUrl(STRAPI_URL)}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
        ...(extraHeaders || {}),
        ...(init.headers || {}),
      },
    },
    timeoutMs
  );

  const text = await res.text().catch(() => "");
  const data = text ? safeJsonParse(text) : null;
  return { res, data, text };
}

async function findFirstOrderByFilter(args: {
  STRAPI_URL: string;
  STRAPI_API_TOKEN: string;
  qs: URLSearchParams;
}) {
  const { STRAPI_URL, STRAPI_API_TOKEN, qs } = args;

  qs.set("pagination[pageSize]", "1");
  qs.set("fields[0]", "id");
  qs.set("fields[1]", "documentId");
  qs.set("publicationState", "preview");

  const r = await strapiRequest(
    STRAPI_URL,
    STRAPI_API_TOKEN,
    `/api/orders?${qs.toString()}`,
    { method: "GET" }
  );

  if (!r.res.ok) return null;

  const first = Array.isArray(r.data?.data) ? r.data.data[0] : null;
  if (!first) return null;

  const a = first?.attributes ?? first ?? {};
  const numericId =
    typeof first?.id === "number" ? first.id : typeof a?.id === "number" ? a.id : null;
  const documentId =
    typeof first?.documentId === "string"
      ? first.documentId
      : typeof a?.documentId === "string"
        ? a.documentId
        : null;

  return { numericId, documentId };
}

async function updateOrderSmart(args: {
  STRAPI_URL: string;
  STRAPI_API_TOKEN: string;
  ORDER_STATUS_WEBHOOK_SECRET: string;
  documentId?: string | null;
  numericId?: number | null;
  payload: any;
}) {
  const {
    STRAPI_URL,
    STRAPI_API_TOKEN,
    ORDER_STATUS_WEBHOOK_SECRET,
    documentId,
    numericId,
    payload,
  } = args;

  const tries: Array<{ label: string; path: string }> = [];
  if (documentId) {
    tries.push({
      label: "documentId",
      path: `/api/orders/${encodeURIComponent(documentId)}`,
    });
  }
  if (typeof numericId === "number") {
    tries.push({
      label: "numericId",
      path: `/api/orders/${encodeURIComponent(String(numericId))}`,
    });
  }

  let last: any = null;

  for (const t of tries) {
    const upd = await strapiRequest(
      STRAPI_URL,
      STRAPI_API_TOKEN,
      t.path,
      {
        method: "PUT",
        body: JSON.stringify({ data: payload }),
      },
      25_000,
      {
        "x-order-status-secret": ORDER_STATUS_WEBHOOK_SECRET,
      }
    );

    if (upd.res.ok) return { ok: true as const, via: t.label };

    last = {
      via: t.label,
      status: upd.res.status,
      details: upd.data ?? upd.text,
    };
  }

  return { ok: false as const, last };
}

export async function GET(request: Request) {
  try {
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
    const STRAPI_URL = process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "";
    const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || "";
    const ORDER_STATUS_WEBHOOK_SECRET = process.env.ORDER_STATUS_WEBHOOK_SECRET || "";

    if (!ORDER_STATUS_WEBHOOK_SECRET) {
      return json({ ok: false, error: "Missing ORDER_STATUS_WEBHOOK_SECRET" }, 500);
    }
    if (!STRIPE_SECRET_KEY) {
      return json({ ok: false, error: "Missing STRIPE_SECRET_KEY" }, 500);
    }
    if (!STRAPI_URL) {
      return json({ ok: false, error: "Missing STRAPI_URL" }, 500);
    }
    if (!STRAPI_API_TOKEN || STRAPI_API_TOKEN.length < 20) {
      return json({ ok: false, error: "Missing STRAPI_API_TOKEN" }, 500);
    }

    const { searchParams } = new URL(request.url);
    const rawSessionId = String(searchParams.get("session_id") || "").trim();
    const session_id = rawSessionId.replace(/^session_id=/, "").trim();

    if (!session_id) {
      return json({ ok: false, error: "Missing session_id" }, 400);
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["payment_intent"],
    });

    const paid =
      session.payment_status === "paid" || session.payment_status === "no_payment_required";
    const complete = session.status === "complete";

    const metadataStrapiDocumentId = getSessionMetadataValue(session, "strapiDocumentId");
    const metadataStrapiOrderId = parsePositiveInt(
      getSessionMetadataValue(session, "strapiOrderId")
    );
    const orderRef = firstNonEmptyString(
      session.client_reference_id,
      getSessionMetadataValue(session, "orderRef")
    );

    const customerEmail =
      firstNonEmptyString(
        session.customer_details?.email,
        session.customer_email,
        getSessionMetadataValue(session, "customerEmail")
      ) || null;

    const stripePaymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent &&
            typeof session.payment_intent === "object" &&
            "id" in session.payment_intent
          ? String(session.payment_intent.id)
          : null;

    if (!paid || !complete) {
      return json({
        ok: true,
        paid: false,
        status: session.status,
        payment_status: session.payment_status,
        orderRef: orderRef || null,
      });
    }

    let found: { numericId: number | null; documentId: string | null } | null = null;

    if (metadataStrapiDocumentId) {
      const qs = new URLSearchParams();
      qs.set("filters[documentId][$eq]", metadataStrapiDocumentId);
      found = await findFirstOrderByFilter({ STRAPI_URL, STRAPI_API_TOKEN, qs });

      if (!found) {
        found = {
          numericId: metadataStrapiOrderId,
          documentId: metadataStrapiDocumentId,
        };
      }
    }

    if (!found && metadataStrapiOrderId) {
      found = {
        numericId: metadataStrapiOrderId,
        documentId: metadataStrapiDocumentId || null,
      };
    }

    if (!found) {
      const qs = new URLSearchParams();
      qs.set("filters[stripeSessionId][$eq]", session_id);
      found = await findFirstOrderByFilter({ STRAPI_URL, STRAPI_API_TOKEN, qs });
    }

    if (!found) {
      return json({
        ok: true,
        paid: true,
        updated: false,
        message: "Payment ok but order not found on Strapi",
        orderRef: orderRef || null,
        refs: {
          strapiOrderId: metadataStrapiOrderId,
          strapiDocumentId: metadataStrapiDocumentId,
          stripeSessionId: session_id,
        },
      });
    }

    const payload: Record<string, any> = {
      orderStatus: "PAID",
      stripeSessionId: session_id,
    };

    if (stripePaymentIntentId) payload.stripePaymentIntentId = stripePaymentIntentId;
    if (customerEmail) payload.customerEmail = customerEmail;

    const upd = await updateOrderSmart({
      STRAPI_URL,
      STRAPI_API_TOKEN,
      ORDER_STATUS_WEBHOOK_SECRET,
      documentId: found.documentId,
      numericId: found.numericId,
      payload,
    });

    if (!upd.ok) {
      return json({
        ok: true,
        paid: true,
        updated: false,
        orderId: found.numericId,
        documentId: found.documentId,
        orderRef: orderRef || found.documentId || null,
        status: upd.last?.status,
        details: upd.last?.details,
        refs: {
          strapiOrderId: metadataStrapiOrderId,
          strapiDocumentId: metadataStrapiDocumentId,
          stripeSessionId: session_id,
        },
      });
    }

    return json({
      ok: true,
      paid: true,
      updated: true,
      orderId: found.numericId,
      documentId: found.documentId,
      orderRef: orderRef || found.documentId || null,
      refs: {
        strapiOrderId: metadataStrapiOrderId,
        strapiDocumentId: metadataStrapiDocumentId,
        stripeSessionId: session_id,
      },
    });
  } catch (e: any) {
    console.error("[checkout/verify] error:", e);
    return json({ ok: false, error: "Verify failed", details: e?.message ?? String(e) }, 500);
  }
}