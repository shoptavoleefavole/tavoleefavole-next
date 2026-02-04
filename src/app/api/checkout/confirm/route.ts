import Stripe from "stripe";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "x-checkout-confirm": "v4-robust" },
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

function getStrapiToken() {
  const t =
    process.env.STRAPI_API_TOKEN ||
    process.env.STRAPI_TOKEN ||
    process.env.NEXT_PUBLIC_STRAPI_API_TOKEN ||
    process.env.NEXT_PUBLIC_STRAPI_TOKEN;

  if (!t) throw new Error("Missing STRAPI token (set STRAPI_API_TOKEN or STRAPI_TOKEN)");
  return String(t).trim();
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function strapiFetch(path: string, init?: RequestInit) {
  const base = strapiBaseUrl();
  const token = getStrapiToken();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };

  // Content-Type SOLO se stiamo mandando JSON (PUT/POST con body string)
  const method = (init?.method || "GET").toUpperCase();
  const hasJsonBody = typeof init?.body === "string" && init.body.trim().startsWith("{");
  if (hasJsonBody && (method === "POST" || method === "PUT" || method === "PATCH")) {
    headers["Content-Type"] = "application/json";
  }

  // merge eventuali headers custom
  const mergedHeaders = { ...headers, ...(init?.headers as any) };

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: mergedHeaders,
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  const data = text ? safeJsonParse(text) : null;
  return { res, data, text };
}

async function findOrder(params: { sessionId: string; orderRef?: string | null; orderId?: string | null }) {
  const { sessionId, orderRef, orderId } = params;

  // 1) per stripeSessionId
  {
    const qs = new URLSearchParams();
    qs.set("filters[stripeSessionId][$eq]", sessionId);
    qs.set("pagination[pageSize]", "1");
    const { res, data } = await strapiFetch(`/api/orders?${qs.toString()}`, { method: "GET" });
    if (res.ok) {
      const first = Array.isArray(data?.data) ? data.data[0] : null;
      if (first) return first;
    }
  }

  // 2) per documentId (se tu lo usi davvero come ref)
  if (orderRef) {
    const qs = new URLSearchParams();
    qs.set("filters[documentId][$eq]", orderRef);
    qs.set("pagination[pageSize]", "1");
    const { res, data } = await strapiFetch(`/api/orders?${qs.toString()}`, { method: "GET" });
    if (res.ok) {
      const first = Array.isArray(data?.data) ? data.data[0] : null;
      if (first) return first;
    }
  }

  // 3) per id numerico (se salvato in metadata)
  if (orderId && /^\d+$/.test(orderId)) {
    const qs = new URLSearchParams();
    qs.set("filters[id][$eq]", orderId);
    qs.set("pagination[pageSize]", "1");
    const { res, data } = await strapiFetch(`/api/orders?${qs.toString()}`, { method: "GET" });
    if (res.ok) {
      const first = Array.isArray(data?.data) ? data.data[0] : null;
      if (first) return first;
    }
  }

  return null;
}

async function updateOrderWithFallback(orderRow: any, payload: any) {
  const idNumeric = orderRow?.id; // ✅ Strapi v4 standard
  const attrs = orderRow?.attributes ?? {};
  const documentId = orderRow?.documentId ?? attrs?.documentId ?? null; // fallback (se esiste davvero nella tua collection)

  // ✅ PRIMA: update via id numerico (standard Strapi v4)
  if (idNumeric != null) {
    const r1 = await strapiFetch(`/api/orders/${encodeURIComponent(String(idNumeric))}`, {
      method: "PUT",
      body: JSON.stringify({ data: payload }),
    });
    if (r1.res.ok) return { ok: true, via: "id" };
    // se fallisce, continuiamo fallback
  }

  // fallback: update via documentId (solo se la tua API lo supporta davvero)
  if (documentId) {
    const r2 = await strapiFetch(`/api/orders/${encodeURIComponent(String(documentId))}`, {
      method: "PUT",
      body: JSON.stringify({ data: payload }),
    });
    if (r2.res.ok) return { ok: true, via: "documentId" };
    return { ok: false, status: r2.res.status, details: r2.data ?? r2.text };
  }

  return { ok: false, status: 404, details: "Missing id/documentId on orderRow" };
}

export async function GET(req: Request) {
  try {
    const STRIPE_SECRET_KEY = requireEnv("STRIPE_SECRET_KEY");
    const sessionId = new URL(req.url).searchParams.get("session_id")?.trim() || "";
    if (!sessionId) return json({ ok: false, error: "Missing session_id" }, 400);

    const stripe = new Stripe(STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // ✅ Definizione più “corretta” per Checkout: pagato + completato
    const paid = session.payment_status === "paid" && session.status === "complete";

    const orderRef =
      (session.metadata?.orderRef ? String(session.metadata.orderRef) : null) ||
      (session.client_reference_id ? String(session.client_reference_id) : null);

    const orderId = session.metadata?.orderId ? String(session.metadata.orderId) : "";

    if (!paid) {
      return json(
        {
          ok: true,
          paid: false,
          payment_status: session.payment_status,
          status: session.status,
          orderRef,
          orderId,
        },
        200
      );
    }

    const orderRow = await findOrder({ sessionId, orderRef, orderId: orderId || null });

    // ✅ Anche se non troviamo l’ordine, per il FE è comunque paid=true (quindi può svuotare)
    if (!orderRow) {
      return json(
        {
          ok: true,
          paid: true,
          updated: false,
          orderRef,
          orderId,
          payment_status: session.payment_status,
          status: session.status,
          updateError: { status: 404, details: "Order not found on Strapi" },
        },
        200
      );
    }

    const stripePaymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;

    const upd = await updateOrderWithFallback(orderRow, {
      orderStatus: "PAID",
      stripeSessionId: sessionId,
      stripePaymentIntentId,
    });

    if (!upd.ok) {
      return json(
        {
          ok: true,
          paid: true,
          updated: false,
          orderRef,
          orderId,
          payment_status: session.payment_status,
          status: session.status,
          updateError: upd,
        },
        200
      );
    }

    return json(
      {
        ok: true,
        paid: true,
        updated: true,
        orderRef,
        orderId,
        payment_status: session.payment_status,
        status: session.status,
      },
      200
    );
  } catch (e: any) {
    return json({ ok: false, error: "Confirm failed", details: e?.message || String(e) }, 500);
  }
}
