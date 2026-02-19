// src/app/api/stripe/webhook/route.ts
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { Buffer } from "buffer";

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

async function fetchWithTimeout(url: string, init: RequestInit, ms = 20_000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

async function strapiFetch(path: string, init?: RequestInit) {
  const base = strapiBaseUrl();
  const token = process.env.STRAPI_API_TOKEN;
  if (!token) throw new Error("Missing STRAPI_API_TOKEN (serve per leggere/aggiornare ordini via webhook)");

  const res = await fetchWithTimeout(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
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

async function findFirstOrderByFilter(qs: URLSearchParams) {
  qs.set("pagination[pageSize]", "1");
  const { res, data, text } = await strapiFetch(`/api/orders?${qs.toString()}`, { method: "GET" });
  if (!res.ok) return { ok: false as const, status: res.status, details: data ?? text };
  const first = Array.isArray(data?.data) ? data.data[0] : null;
  return { ok: true as const, first };
}

async function findOrder(params: { sessionId: string; orderRef?: string | null; orderId?: string | null }) {
  const { sessionId, orderRef, orderId } = params;

  // 1) stripeSessionId
  {
    const qs = new URLSearchParams();
    qs.set("filters[stripeSessionId][$eq]", sessionId);
    const r = await findFirstOrderByFilter(qs);
    if (r.ok && r.first) return r.first;
  }

  // 2) documentId
  if (orderRef) {
    const qs = new URLSearchParams();
    qs.set("filters[documentId][$eq]", orderRef);
    const r = await findFirstOrderByFilter(qs);
    if (r.ok && r.first) return r.first;
  }

  // 3) numeric id
  if (orderId && /^\d+$/.test(orderId)) {
    const qs = new URLSearchParams();
    qs.set("filters[id][$eq]", orderId);
    const r = await findFirstOrderByFilter(qs);
    if (r.ok && r.first) return r.first;
  }

  return null;
}

async function updateOrderSmart(orderRow: any, payload: any) {
  const { numericId, documentId } = pickOrderIds(orderRow);

  const tries: Array<{ label: string; path: string }> = [];
  if (documentId) tries.push({ label: "documentId", path: `/api/orders/${encodeURIComponent(documentId)}` });
  if (typeof numericId === "number")
    tries.push({ label: "numericId", path: `/api/orders/${encodeURIComponent(String(numericId))}` });

  let last: any = null;

  for (const t of tries) {
    const r = await strapiFetch(t.path, {
      method: "PUT",
      body: JSON.stringify({ data: payload }),
    });

    if (r.res.ok) return { ok: true as const, used: t.label };
    last = { used: t.label, status: r.res.status, details: r.data ?? r.text };
  }

  return { ok: false as const, last };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: Request) {
  try {
    console.log("[stripe/webhook] HIT", new Date().toISOString());

    const STRIPE_SECRET_KEY = requireEnv("STRIPE_SECRET_KEY");
    const STRIPE_WEBHOOK_SECRET = requireEnv("STRIPE_WEBHOOK_SECRET");

    const sig = req.headers.get("stripe-signature");
    if (!sig) return json({ ok: false, error: "Missing stripe-signature header" }, 400);

    const rawBuf = Buffer.from(await req.arrayBuffer());

    // ✅ ROBUSTO: niente apiVersion hardcoded (evita build fail e rotture future)
    const stripe = new Stripe(STRIPE_SECRET_KEY);

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBuf, sig, STRIPE_WEBHOOK_SECRET);
    } catch (e: any) {
      console.error("[stripe/webhook] invalid signature", e?.message || e);
      return json({ ok: false, error: "Invalid signature", details: e?.message || String(e) }, 400);
    }

    console.log("[stripe/webhook] type =", event.type);

    if (event.type !== "checkout.session.completed") {
      return json({ ok: true, ignored: true, type: event.type }, 200);
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const sessionId = session.id;

    const orderRef =
      (session.metadata?.orderRef ? String(session.metadata.orderRef) : null) ||
      (session.client_reference_id ? String(session.client_reference_id) : null);

    const orderIdMeta = session.metadata?.orderId ? String(session.metadata.orderId) : null;

    let orderRow: any = null;
    for (let i = 0; i < 8; i++) {
      orderRow = await findOrder({ sessionId, orderRef, orderId: orderIdMeta });
      if (orderRow) break;
      await sleep(300 + i * 250);
    }

    if (!orderRow) {
      console.error("[stripe/webhook] order NOT found", { sessionId, orderRef, orderIdMeta });
      return json(
        { ok: false, error: "Order not found on Strapi (will retry).", debug: { sessionId, orderRef, orderId: orderIdMeta } },
        500
      );
    }

    const stripePaymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
    const customerEmail = session.customer_details?.email ?? session.customer_email ?? session.metadata?.customerEmail ?? null;

    const payload: any = {
      orderStatus: "PAID",
      stripeSessionId: sessionId,
      stripePaymentIntentId,
      customerEmail,
    };

    const upd = await updateOrderSmart(orderRow, payload);

    if (!upd.ok) {
      console.error("[stripe/webhook] Strapi update failed", upd.last);
      return json({ ok: false, error: "Failed updating order on Strapi", ...upd.last }, 500);
    }

    console.log("[stripe/webhook] updated order => PAID (via", upd.used, ")");
    return json({ ok: true, updated: true, via: upd.used, sessionId }, 200);
  } catch (e: any) {
    console.error("[stripe/webhook] error:", e);
    return json({ ok: false, error: "Webhook error", details: e?.message || String(e) }, 500);
  }
}
