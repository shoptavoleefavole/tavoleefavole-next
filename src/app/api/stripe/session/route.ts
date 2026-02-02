import Stripe from "stripe";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function pickPaymentIntentId(input: Stripe.Checkout.Session["payment_intent"]) {
  if (!input) return null;
  if (typeof input === "string") return input;
  const id = (input as any)?.id;
  return typeof id === "string" ? id : null;
}

async function updateOrderById(opts: {
  strapiUrl: string;
  token: string;
  id: string | number;
  data: any;
}) {
  const { strapiUrl, token, id, data } = opts;

  const r = await fetch(`${strapiUrl}/api/orders/${encodeURIComponent(String(id))}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ data }),
    cache: "no-store",
  });

  return r.ok;
}

async function findOrderIdByFilter(opts: {
  strapiUrl: string;
  token: string;
  filter: string; // querystring pronto dopo '?'
}) {
  const { strapiUrl, token, filter } = opts;

  const res = await fetch(`${strapiUrl}/api/orders?${filter}&pagination[pageSize]=1`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  const json = safeJsonParse(text);

  const found = Array.isArray(json?.data) ? json.data[0] : null;
  const id = found?.id;

  return typeof id === "number" || typeof id === "string" ? id : null;
}

async function updateOrder(opts: {
  strapiUrl: string;
  token: string;
  ref: string;
  data: any;
}) {
  const { strapiUrl, token, ref, data } = opts;

  // 1) tentativo diretto (Strapi 5 spesso accetta documentId qui)
  const direct = await fetch(`${strapiUrl}/api/orders/${encodeURIComponent(ref)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ data }),
    cache: "no-store",
  });

  if (direct.ok) return true;

  // 2) fallback: cerca per documentId
  const byDocId = await findOrderIdByFilter({
    strapiUrl,
    token,
    filter: `filters[documentId][$eq]=${encodeURIComponent(ref)}`,
  });

  if (byDocId != null) {
    const ok = await updateOrderById({ strapiUrl, token, id: byDocId, data });
    if (ok) return true;
  }

  // 3) fallback: cerca per id
  const byId = await findOrderIdByFilter({
    strapiUrl,
    token,
    filter: `filters[id][$eq]=${encodeURIComponent(ref)}`,
  });

  if (byId != null) {
    const ok = await updateOrderById({ strapiUrl, token, id: byId, data });
    if (ok) return true;
  }

  return false;
}

function pickOrderRefFromMetadata(metadata: any) {
  return metadata?.orderDocumentId || metadata?.orderId || metadata?.orderRef || null;
}

async function pickOrderRefFallbackBySessionId(opts: {
  strapiUrl: string;
  token: string;
  sessionId: string;
}) {
  const { strapiUrl, token, sessionId } = opts;

  const id = await findOrderIdByFilter({
    strapiUrl,
    token,
    filter: `filters[stripeSessionId][$eq]=${encodeURIComponent(sessionId)}`,
  });

  return id != null ? String(id) : null;
}

export async function GET(req: Request) {
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const STRAPI_URL = process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL;
  const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
  }
  if (!STRAPI_URL || !STRAPI_API_TOKEN) {
    return NextResponse.json(
      { error: "Missing STRAPI_URL / STRAPI_API_TOKEN" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const sessionId = (searchParams.get("session_id") ?? "").trim();
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY);

  try {
    // Recupero sessione
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const paid = session.payment_status === "paid";
    const paymentIntentId = pickPaymentIntentId(session.payment_intent);

    // prova ref da metadata, altrimenti da stripeSessionId salvato su Strapi
    let orderRef = pickOrderRefFromMetadata(session.metadata);
    if (!orderRef) {
      orderRef = await pickOrderRefFallbackBySessionId({
        strapiUrl: STRAPI_URL,
        token: STRAPI_API_TOKEN,
        sessionId: session.id,
      });
    }

    // update (best effort) se pagato
    let updated = false;
    if (paid && orderRef) {
      updated = await updateOrder({
        strapiUrl: STRAPI_URL,
        token: STRAPI_API_TOKEN,
        ref: String(orderRef),
        data: {
          orderStatus: "PAID",
          stripeSessionId: session.id,
          ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
        },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        paid,
        updated,
        orderRef: orderRef ? String(orderRef) : null,
        stripeSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to retrieve session", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
