// src/app/api/stripe/webhook/route.ts
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { Buffer } from "buffer";
import { sendOrderConfirmationEmail } from "@/lib/order-emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function strapiBaseUrl() {
  return (process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337").replace(/\/+$/, "");
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isRetryableFetchError(e: any) {
  const code = e?.cause?.code || e?.code;
  return (
    e?.name === "AbortError" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "UND_ERR_SOCKET" ||
    code === "EAI_AGAIN" ||
    String(e?.message || "").toLowerCase().includes("fetch failed")
  );
}

async function fetchWithTimeout(url: string, init: RequestInit, ms = 20_000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

async function fetchWithRetry(url: string, init: RequestInit, ms = 20_000) {
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

async function strapiFetch(
  path: string,
  init?: RequestInit,
  extraHeaders?: Record<string, string>
) {
  const base = strapiBaseUrl();
  const token = process.env.STRAPI_API_TOKEN;
  if (!token) throw new Error("Missing STRAPI_API_TOKEN");

  const res = await fetchWithRetry(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(extraHeaders || {}),
      ...(init?.headers || {}),
    },
  });

  const text = await res.text().catch(() => "");
  const data = text ? safeJsonParse(text) : null;
  return { res, data, text };
}

function pickAttrs(row: any) {
  return row?.attributes ?? row ?? {};
}

function pickOrderIds(row: any): { numericId: number | null; documentId: string | null } {
  const a = pickAttrs(row);
  const numericId = typeof row?.id === "number" ? row.id : typeof a?.id === "number" ? a.id : null;
  const documentId =
    typeof row?.documentId === "string"
      ? row.documentId
      : typeof a?.documentId === "string"
        ? a.documentId
        : null;
  return { numericId, documentId };
}

function getSessionRefs(session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {};
  const numericOrderIdRaw =
    typeof metadata.strapiOrderId === "string"
      ? metadata.strapiOrderId
      : typeof metadata.orderId === "string"
        ? metadata.orderId
        : "";
  const numericOrderId = /^\d+$/.test(numericOrderIdRaw.trim()) ? numericOrderIdRaw.trim() : null;

  const documentId =
    typeof metadata.strapiDocumentId === "string"
      ? metadata.strapiDocumentId.trim()
      : typeof metadata.orderDocumentId === "string"
        ? metadata.orderDocumentId.trim()
        : typeof metadata.documentId === "string"
          ? metadata.documentId.trim()
          : null;

  const orderRef =
    typeof metadata.orderRef === "string" && metadata.orderRef.trim()
      ? metadata.orderRef.trim()
      : typeof session.client_reference_id === "string" && session.client_reference_id.trim()
        ? session.client_reference_id.trim()
        : null;

  return { numericOrderId, documentId, orderRef };
}

async function findFirstOrderByFilter(qs: URLSearchParams) {
  qs.set("pagination[pageSize]", "1");
  const { res, data, text } = await strapiFetch(`/api/orders?${qs.toString()}`, { method: "GET" });
  if (!res.ok) return { ok: false as const, status: res.status, details: data ?? text };
  const first = Array.isArray(data?.data) ? data.data[0] : null;
  return { ok: true as const, first };
}

async function findOrder(params: {
  sessionId: string;
  numericOrderId?: string | null;
  documentId?: string | null;
}) {
  const { sessionId, numericOrderId, documentId } = params;

  {
    const qs = new URLSearchParams();
    qs.set("filters[stripeSessionId][$eq]", sessionId);
    const r = await findFirstOrderByFilter(qs);
    if (r.ok && r.first) return r.first;
  }

  if (numericOrderId) {
    const qs = new URLSearchParams();
    qs.set("filters[id][$eq]", numericOrderId);
    const r = await findFirstOrderByFilter(qs);
    if (r.ok && r.first) return r.first;
  }

  if (documentId) {
    const qs = new URLSearchParams();
    qs.set("filters[documentId][$eq]", documentId);
    const r = await findFirstOrderByFilter(qs);
    if (r.ok && r.first) return r.first;
  }

  return null;
}

async function resolveNumericId(orderRow: any) {
  const { numericId, documentId } = pickOrderIds(orderRow);
  if (typeof numericId === "number") return numericId;
  if (!documentId) return null;

  const qs = new URLSearchParams();
  qs.set("filters[documentId][$eq]", documentId);
  qs.set("pagination[pageSize]", "1");
  qs.set("fields[0]", "id");

  const r = await strapiFetch(`/api/orders?${qs.toString()}`, { method: "GET" });
  if (!r.res.ok) return null;
  const first = Array.isArray(r.data?.data) ? r.data.data[0] : null;
  return typeof first?.id === "number" ? first.id : null;
}

function toSafeLogMessage(details: any) {
  const message =
    typeof details?.error?.message === "string"
      ? details.error.message
      : typeof details?.message === "string"
        ? details.message
        : null;
  return message;
}

async function updateOrderByNumericId(
  orderRow: any,
  payload: any,
  orderStatusSecret: string
) {
  const numericId = await resolveNumericId(orderRow);
  if (!numericId) {
    return {
      ok: false as const,
      last: { used: "none", status: 404, message: "Numeric order id unavailable" },
    };
  }

  const r = await strapiFetch(
    `/api/orders/${encodeURIComponent(String(numericId))}`,
    {
      method: "PUT",
      body: JSON.stringify({ data: payload }),
    },
    {
      "x-order-status-secret": orderStatusSecret,
    }
  );

  if (r.res.ok) return { ok: true as const, used: "numericId" };

  return {
    ok: false as const,
    last: {
      used: "numericId",
      status: r.res.status,
      message: toSafeLogMessage(r.data) ?? "Strapi update failed",
    },
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: Request) {
  try {
    console.info("[stripe/webhook] HIT", new Date().toISOString());

    const STRIPE_SECRET_KEY = requireEnv("STRIPE_SECRET_KEY");
    const STRIPE_WEBHOOK_SECRET = requireEnv("STRIPE_WEBHOOK_SECRET");
    const ORDER_STATUS_WEBHOOK_SECRET = requireEnv("ORDER_STATUS_WEBHOOK_SECRET");

    const sig = req.headers.get("stripe-signature");
    if (!sig) return json({ ok: false, error: "Missing stripe-signature header" }, 400);

    const rawBuf = Buffer.from(await req.arrayBuffer());
    const stripe = new Stripe(STRIPE_SECRET_KEY);

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBuf, sig, STRIPE_WEBHOOK_SECRET);
    } catch {
      console.error("[stripe/webhook] invalid signature");
      return json({ ok: false, error: "Invalid signature" }, 400);
    }

    console.info("[stripe/webhook] type =", event.type);

    if (event.type !== "checkout.session.completed") {
      return json({ ok: true, ignored: true, type: event.type }, 200);
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const sessionId = session.id;
    const refs = getSessionRefs(session);

    let orderRow: any = null;
    for (let i = 0; i < 8; i++) {
      orderRow = await findOrder({
        sessionId,
        numericOrderId: refs.numericOrderId,
        documentId: refs.documentId,
      });
      if (orderRow) break;
      await sleep(300 + i * 250);
    }

    if (!orderRow) {
      console.error("[stripe/webhook] order not found", {
        sessionId,
        orderRef: refs.orderRef,
        orderId: refs.numericOrderId,
        documentId: refs.documentId,
      });
      return json({ ok: false, error: "Order not found on Strapi" }, 500);
    }

    const stripePaymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
const customerEmail =
  session.customer_details?.email ?? session.customer_email ?? session.metadata?.customerEmail ?? null;

const orderAttrs = pickAttrs(orderRow);
const alreadySent = !!orderAttrs?.orderConfirmationEmailSentAt;

const payload: any = {
  orderStatus: "PAID",
  stripeSessionId: sessionId,
  stripePaymentIntentId,
  customerEmail,
};

const upd = await updateOrderByNumericId(orderRow, payload, ORDER_STATUS_WEBHOOK_SECRET);

if (!upd.ok) {
  console.error("[stripe/webhook] Strapi update failed", {
    used: upd.last.used,
    status: upd.last.status,
    message: upd.last.message,
  });
  return json({ ok: false, error: "Failed updating order on Strapi" }, 500);
}

    console.info("[stripe/webhook] updated order => PAID", {
      via: upd.used,
      sessionId,
    });

    if (alreadySent) {
      console.info("[stripe/webhook] order email already sent, skip", { sessionId });
      return json({ ok: true, updated: true, emailed: false, skipped: "already_sent", via: upd.used, sessionId }, 200);
    }

    const resolvedNumericId = await resolveNumericId(orderRow);
    const emailTo = String(orderAttrs?.customerEmail || customerEmail || "").trim().toLowerCase();

    const emailResult = await sendOrderConfirmationEmail({
      to: emailTo,
      orderLabel: refs.orderRef || (resolvedNumericId ? `#${resolvedNumericId}` : "ordine"),
      items: Array.isArray(orderAttrs?.items) ? orderAttrs.items : [],
      subtotal: typeof orderAttrs?.subtotal === "number" ? orderAttrs.subtotal : null,
      discountTotal: typeof orderAttrs?.discountTotal === "number" ? orderAttrs.discountTotal : null,
      shippingTotal: typeof orderAttrs?.shippingTotal === "number" ? orderAttrs.shippingTotal : null,
      total: typeof orderAttrs?.total === "number" ? orderAttrs.total : null,
      currency: typeof orderAttrs?.currency === "string" ? orderAttrs.currency : "EUR",
      shippingAddress:
        orderAttrs?.shippingAddress && typeof orderAttrs.shippingAddress === "object"
          ? orderAttrs.shippingAddress
          : null,
    });

    if (!emailResult.ok) {
      console.error("[stripe/webhook] order confirmation email failed", {
        sessionId,
        error: emailResult.error,
      });
      return json({ ok: false, error: "Order confirmation email failed" }, 500);
    }

    const sentAt = new Date().toISOString();
    const markSent = await updateOrderByNumericId(
      orderRow,
      { orderConfirmationEmailSentAt: sentAt },
      ORDER_STATUS_WEBHOOK_SECRET
    );

    if (!markSent.ok) {
      console.error("[stripe/webhook] failed to mark order email as sent", {
        sessionId,
        used: markSent.last.used,
        status: markSent.last.status,
        message: markSent.last.message,
      });
      return json({ ok: false, error: "Failed to mark order email as sent" }, 500);
    }

    console.info("[stripe/webhook] order confirmation email sent", {
      sessionId,
      to: emailTo,
    });

    return json({ ok: true, updated: true, emailed: true, via: upd.used, sessionId }, 200);
  } catch (e: any) {
    console.error("[stripe/webhook] error:", e?.message || String(e));
    return json({ ok: false, error: "Webhook error" }, 500);
  }
}
