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
      "x-checkout-verify": "v1",
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
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, i))); // 500ms, 1000ms
    }
  }
  throw lastErr;
}

async function strapiRequest(
  STRAPI_URL: string,
  STRAPI_API_TOKEN: string,
  path: string,
  init: RequestInit,
  timeoutMs = 25_000
) {
  const res = await fetchWithRetry(`${strapiBaseUrl(STRAPI_URL)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  }, timeoutMs);

  const text = await res.text().catch(() => "");
  const data = text ? safeJsonParse(text) : null;
  return { res, data, text };
}

async function findOrderNumericIdByDocumentId(args: {
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

async function findOrderNumericIdByStripeSessionId(args: {
  STRAPI_URL: string;
  STRAPI_API_TOKEN: string;
  stripeSessionId: string;
}) {
  const { STRAPI_URL, STRAPI_API_TOKEN, stripeSessionId } = args;

  const qs = new URLSearchParams();
  qs.set("filters[stripeSessionId][$eq]", stripeSessionId);
  qs.set("pagination[pageSize]", "1");
  qs.set("fields[0]", "id");

  const r = await strapiRequest(STRAPI_URL, STRAPI_API_TOKEN, `/api/orders?${qs.toString()}`, { method: "GET" });
  if (!r.res.ok) return null;

  const first = Array.isArray(r.data?.data) ? r.data.data[0] : null;
  const id = first?.id;
  return typeof id === "number" ? id : null;
}

export async function GET(request: Request) {
  try {
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
    const STRAPI_URL = process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "";
    const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || "";

    if (!STRIPE_SECRET_KEY) return json({ ok: false, error: "Missing STRIPE_SECRET_KEY" }, 500);
    if (!STRAPI_URL) return json({ ok: false, error: "Missing STRAPI_URL" }, 500);
    if (!STRAPI_API_TOKEN || STRAPI_API_TOKEN.length < 20) return json({ ok: false, error: "Missing STRAPI_API_TOKEN" }, 500);

    const { searchParams } = new URL(request.url);
    const session_id = String(searchParams.get("session_id") || "").trim();
    if (!session_id) return json({ ok: false, error: "Missing session_id" }, 400);

    const stripe = new Stripe(STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["payment_intent"],
    });

    // Stripe Checkout Session:
    // - status: "complete" quando finito
    // - payment_status: "paid" quando pagato
    const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
    const complete = session.status === "complete";

    const orderRef =
      (typeof session.client_reference_id === "string" && session.client_reference_id.trim()) ? session.client_reference_id.trim()
      : (typeof (session as any)?.metadata?.orderRef === "string" && (session as any).metadata.orderRef.trim()) ? (session as any).metadata.orderRef.trim()
      : "";

    // Se non è ancora paid, rispondiamo senza aggiornare Strapi
    if (!paid || !complete) {
      return json({
        ok: true,
        paid: false,
        status: session.status,
        payment_status: session.payment_status,
        orderRef: orderRef || null,
      });
    }

    // Troviamo l'ordine su Strapi e lo mettiamo PAID
    let numericOrderId: number | null = null;

    // 1) prova via documentId (orderRef)
    if (orderRef) {
      numericOrderId = await findOrderNumericIdByDocumentId({ STRAPI_URL, STRAPI_API_TOKEN, documentId: orderRef });
    }

    // 2) fallback: prova via stripeSessionId
    if (!numericOrderId) {
      numericOrderId = await findOrderNumericIdByStripeSessionId({ STRAPI_URL, STRAPI_API_TOKEN, stripeSessionId: session_id });
    }

    if (!numericOrderId) {
      // Non blocchiamo: il pagamento è ok ma non troviamo l’ordine
      return json({
        ok: true,
        paid: true,
        updated: false,
        message: "Payment ok but order not found on Strapi",
        orderRef: orderRef || null,
      });
    }

    // Aggiorno solo campi sicuri già presenti nel tuo schema (orderStatus e stripeSessionId)
    const payload = { data: { orderStatus: "PAID", stripeSessionId: session_id } };

    const upd = await strapiRequest(
      STRAPI_URL,
      STRAPI_API_TOKEN,
      `/api/orders/${encodeURIComponent(String(numericOrderId))}`,
      { method: "PUT", body: JSON.stringify(payload) }
    );

    if (!upd.res.ok) {
      return json({
        ok: true,
        paid: true,
        updated: false,
        orderId: numericOrderId,
        status: upd.res.status,
        details: upd.data ?? upd.text,
      });
    }

    return json({
      ok: true,
      paid: true,
      updated: true,
      orderId: numericOrderId,
      orderRef: orderRef || null,
    });
  } catch (e: any) {
    console.error("[checkout/verify] error:", e);
    return json({ ok: false, error: "Verify failed", details: e?.message ?? String(e) }, 500);
  }
}
