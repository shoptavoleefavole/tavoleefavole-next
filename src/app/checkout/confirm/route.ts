import Stripe from "stripe";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function env(name: string) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : null;
}

function requireEnv(name: string) {
  const v = env(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function strapiBaseUrl() {
  return (process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337").replace(/\/+$/, "");
}

async function strapiFetch(path: string, init?: RequestInit) {
  const base = strapiBaseUrl();
  const token = env("STRAPI_API_TOKEN");
  if (!token) throw new Error("Missing STRAPI_API_TOKEN");

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  return { res, data, text };
}

async function findOrderByStripeSessionId(sessionId: string) {
  const qs = new URLSearchParams();
  qs.set("filters[stripeSessionId][$eq]", sessionId);
  qs.set("pagination[pageSize]", "1");
  qs.set("sort[0]", "createdAt:desc");
  const { res, data } = await strapiFetch(`/api/orders?${qs.toString()}`, { method: "GET" });
  if (!res.ok) return null;
  return Array.isArray(data?.data) ? data.data[0] ?? null : null;
}

async function findOrderByDocumentId(documentId: string) {
  const qs = new URLSearchParams();
  qs.set("filters[documentId][$eq]", documentId);
  qs.set("pagination[pageSize]", "1");
  qs.set("sort[0]", "createdAt:desc");
  const { res, data } = await strapiFetch(`/api/orders?${qs.toString()}`, { method: "GET" });
  if (!res.ok) return null;
  return Array.isArray(data?.data) ? data.data[0] ?? null : null;
}

async function updateOrderByNumericId(id: number, payload: any) {
  const { res, data, text } = await strapiFetch(`/api/orders/${encodeURIComponent(String(id))}`, {
    method: "PUT",
    body: JSON.stringify({ data: payload }),
  });
  if (!res.ok) return { ok: false as const, status: res.status, details: data ?? text };
  return { ok: true as const };
}

export async function GET(req: Request) {
  try {
    const STRIPE_SECRET_KEY = requireEnv("STRIPE_SECRET_KEY");

    const url = new URL(req.url);
    const sessionId = String(url.searchParams.get("session_id") || "").trim();
    if (!sessionId) return json({ ok: false, error: "Missing session_id" }, 400);

    const stripe = new Stripe(STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const payment_status = session.payment_status ?? null; // "paid" | "unpaid" | ...
    const status = session.status ?? null; // "complete" | "open" | ...

    const paid = payment_status === "paid" || status === "complete";

    // orderRef: preferito (documentId)
    const orderRef =
      (session.client_reference_id ? String(session.client_reference_id) : "") ||
      (session.metadata?.orderRef ? String(session.metadata.orderRef) : "");

    const orderIdMeta =
      session.metadata?.orderId && /^\d+$/.test(String(session.metadata.orderId))
        ? String(session.metadata.orderId)
        : "";

    // trova ordine su Strapi
    let orderRow = await findOrderByStripeSessionId(sessionId);

    if (!orderRow && orderRef) {
      orderRow = await findOrderByDocumentId(orderRef);
    }

    if (!orderRow) {
      return json(
        {
          ok: false,
          error: "Order not found on Strapi",
          details: { sessionId, orderRef: orderRef || null, orderIdMeta: orderIdMeta || null },
        },
        404
      );
    }

    const numericId = typeof orderRow?.id === "number" ? orderRow.id : null;
    const attrs = orderRow?.attributes ?? orderRow ?? {};
    const currentStatus = String(attrs?.orderStatus || "").toUpperCase();

    // se non pagato, non aggiorniamo
    if (!paid) {
      return json({
        ok: true,
        paid: false,
        orderRef: orderRef || attrs?.documentId || null,
        orderId: orderIdMeta || String(numericId || ""),
        payment_status,
        status,
        updated: false,
      });
    }

    // già pagato
    if (currentStatus === "PAID") {
      return json({
        ok: true,
        paid: true,
        orderRef: orderRef || attrs?.documentId || null,
        orderId: orderIdMeta || String(numericId || ""),
        payment_status,
        status,
        updated: false,
      });
    }

    // aggiorna a PAID
    if (!numericId) {
      return json({ ok: false, error: "Order row missing numeric id (cannot update)" }, 500);
    }

    const stripePaymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;

    const upd = await updateOrderByNumericId(numericId, {
      orderStatus: "PAID",
      stripeSessionId: sessionId,
      stripePaymentIntentId,
      // utile: salva email se presente
      customerEmail: session.customer_details?.email ?? session.customer_email ?? null,
    });

    if (!upd.ok) {
      return json(
        {
          ok: true,
          paid: true,
          orderRef: orderRef || attrs?.documentId || null,
          orderId: orderIdMeta || String(numericId),
          payment_status,
          status,
          updated: false,
          updateError: upd.details,
        },
        200
      );
    }

    return json({
      ok: true,
      paid: true,
      orderRef: orderRef || attrs?.documentId || null,
      orderId: orderIdMeta || String(numericId),
      payment_status,
      status,
      updated: true,
    });
  } catch (e: any) {
    return json({ ok: false, error: "Confirm error", details: e?.message || String(e) }, 500);
  }
}
