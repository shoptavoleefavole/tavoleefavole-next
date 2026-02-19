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

async function findFirstOrderByFilter(args: {
  STRAPI_URL: string;
  STRAPI_API_TOKEN: string;
  qs: URLSearchParams;
}) {
  const { STRAPI_URL, STRAPI_API_TOKEN, qs } = args;
  qs.set("pagination[pageSize]", "1");
  qs.set("fields[0]", "id");
  qs.set("fields[1]", "documentId");

  const r = await strapiRequest(STRAPI_URL, STRAPI_API_TOKEN, `/api/orders?${qs.toString()}`, { method: "GET" });
  if (!r.res.ok) return null;

  const first = Array.isArray(r.data?.data) ? r.data.data[0] : null;
  if (!first) return null;

  // supporta sia Strapi v4 (attributes) che v5 (flat)
  const a = first?.attributes ?? first ?? {};
  const numericId = typeof first?.id === "number" ? first.id : typeof a?.id === "number" ? a.id : null;
  const documentId =
    typeof first?.documentId === "string" ? first.documentId : typeof a?.documentId === "string" ? a.documentId : null;

  return { numericId, documentId };
}

async function updateOrderSmart(args: {
  STRAPI_URL: string;
  STRAPI_API_TOKEN: string;
  documentId?: string | null;
  numericId?: number | null;
  payload: any;
}) {
  const { STRAPI_URL, STRAPI_API_TOKEN, documentId, numericId, payload } = args;

  const tries: Array<{ label: string; path: string }> = [];
  if (documentId) tries.push({ label: "documentId", path: `/api/orders/${encodeURIComponent(documentId)}` });
  if (typeof numericId === "number") tries.push({ label: "numericId", path: `/api/orders/${encodeURIComponent(String(numericId))}` });

  let last: any = null;

  for (const t of tries) {
    const upd = await strapiRequest(
      STRAPI_URL,
      STRAPI_API_TOKEN,
      t.path,
      { method: "PUT", body: JSON.stringify({ data: payload }) }
    );

    if (upd.res.ok) return { ok: true as const, via: t.label };

    last = { via: t.label, status: upd.res.status, details: upd.data ?? upd.text };
  }

  return { ok: false as const, last };
}

export async function GET(request: Request) {
  try {
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
    const STRAPI_URL = process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "";
    const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || "";

    if (!STRIPE_SECRET_KEY) return json({ ok: false, error: "Missing STRIPE_SECRET_KEY" }, 500);
    if (!STRAPI_URL) return json({ ok: false, error: "Missing STRAPI_URL" }, 500);
    if (!STRAPI_API_TOKEN || STRAPI_API_TOKEN.length < 20)
      return json({ ok: false, error: "Missing STRAPI_API_TOKEN" }, 500);

    const { searchParams } = new URL(request.url);
    const session_id = String(searchParams.get("session_id") || "").trim();
    if (!session_id) return json({ ok: false, error: "Missing session_id" }, 400);

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-12-15.clover" });

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["payment_intent"],
    });

    const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
    const complete = session.status === "complete";

    const orderRef =
      (typeof session.client_reference_id === "string" && session.client_reference_id.trim())
        ? session.client_reference_id.trim()
        : (typeof (session as any)?.metadata?.orderRef === "string" && (session as any).metadata.orderRef.trim())
          ? (session as any).metadata.orderRef.trim()
          : "";

    if (!paid || !complete) {
      return json({
        ok: true,
        paid: false,
        status: session.status,
        payment_status: session.payment_status,
        orderRef: orderRef || null,
      });
    }

    // 1) trova ordine in Strapi (prima documentId, poi stripeSessionId)
    let found: { numericId: number | null; documentId: string | null } | null = null;

    if (orderRef) {
      const qs = new URLSearchParams();
      qs.set("filters[documentId][$eq]", orderRef);
      found = await findFirstOrderByFilter({ STRAPI_URL, STRAPI_API_TOKEN, qs });
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
      });
    }

    const payload = { orderStatus: "PAID", stripeSessionId: session_id };

    const upd = await updateOrderSmart({
      STRAPI_URL,
      STRAPI_API_TOKEN,
      documentId: found.documentId ?? (orderRef || null),
      numericId: found.numericId,
      payload,
    });

    if (!upd.ok) {
      return json({
        ok: true,
        paid: true,
        updated: false,
        orderRef: orderRef || found.documentId || null,
        status: upd.last?.status,
        details: upd.last?.details,
      });
    }

    return json({
      ok: true,
      paid: true,
      updated: true,
      orderId: found.numericId,
      orderRef: orderRef || found.documentId || null,
    });
  } catch (e: any) {
    console.error("[checkout/verify] error:", e);
    return json({ ok: false, error: "Verify failed", details: e?.message ?? String(e) }, 500);
  }
}
