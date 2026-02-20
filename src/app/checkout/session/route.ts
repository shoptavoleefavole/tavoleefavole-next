// src/app/checkout/session/route.ts
import Stripe from "stripe";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonNoStore(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY || "";
  // ✅ NON lanciare errori a import-time: questa funzione viene chiamata solo dentro GET/POST
  if (!key || !key.startsWith("sk_")) {
    const e: any = new Error("Server misconfigured");
    e.code = "SERVER_MISCONFIGURED";
    throw e;
  }
  return new Stripe(key);
}

function pickSessionIdFromUrl(reqUrl: string) {
  const url = new URL(reqUrl);
  const sid =
    url.searchParams.get("session_id") ||
    url.searchParams.get("sessionId") ||
    url.searchParams.get("id") ||
    "";
  return sid.trim();
}

function isValidCheckoutSessionId(id: string) {
  // Checkout Session IDs: cs_...
  return /^cs_[A-Za-z0-9_]+$/.test(id);
}

async function readSessionIdFromBody(req: Request) {
  const text = await req.text().catch(() => "");
  if (!text) return "";
  try {
    const json = JSON.parse(text);
    const sid = String(json?.session_id ?? json?.sessionId ?? json?.id ?? "").trim();
    return sid;
  } catch {
    return "";
  }
}

function safeSessionPayload(session: Stripe.Checkout.Session) {
  const pi = session.payment_intent;
  const paymentIntentId =
    typeof pi === "string" ? pi : typeof (pi as any)?.id === "string" ? (pi as any).id : null;

  return {
    id: session.id,
    status: session.status ?? null,
    payment_status: session.payment_status ?? null,
    amount_total: typeof session.amount_total === "number" ? session.amount_total : null,
    currency: session.currency ?? null,
    customer_email: session.customer_details?.email ?? session.customer_email ?? null,
    client_reference_id: session.client_reference_id ?? null,
    metadata: session.metadata ?? {},
    payment_intent_id: paymentIntentId,
  };
}

export async function GET(req: Request) {
  try {
    const sessionId = pickSessionIdFromUrl(req.url);
    if (!sessionId || !isValidCheckoutSessionId(sessionId)) {
      return jsonNoStore({ ok: false, error: "INVALID_SESSION_ID" }, 400);
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    return jsonNoStore({ ok: true, session: safeSessionPayload(session) }, 200);
  } catch (e: any) {
    const code = e?.code || "SESSION_LOOKUP_FAILED";
    return jsonNoStore(
      {
        ok: false,
        error: code,
        ...(process.env.NODE_ENV === "development" ? { details: e?.message ?? String(e) } : {}),
      },
      code === "SERVER_MISCONFIGURED" ? 500 : 502
    );
  }
}

// ✅ opzionale: supporto POST (se qualche tuo client lo usa già)
export async function POST(req: Request) {
  try {
    const sessionId = (await readSessionIdFromBody(req)) || pickSessionIdFromUrl(req.url);
    if (!sessionId || !isValidCheckoutSessionId(sessionId)) {
      return jsonNoStore({ ok: false, error: "INVALID_SESSION_ID" }, 400);
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    return jsonNoStore({ ok: true, session: safeSessionPayload(session) }, 200);
  } catch (e: any) {
    const code = e?.code || "SESSION_LOOKUP_FAILED";
    return jsonNoStore(
      {
        ok: false,
        error: code,
        ...(process.env.NODE_ENV === "development" ? { details: e?.message ?? String(e) } : {}),
      },
      code === "SERVER_MISCONFIGURED" ? 500 : 502
    );
  }
}