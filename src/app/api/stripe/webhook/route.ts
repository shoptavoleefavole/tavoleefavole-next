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
  return (process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337").replace(
    /\/+$/,
    ""
  );
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
  const token = process.env.STRAPI_API_TOKEN;
  if (!token) throw new Error("Missing STRAPI_API_TOKEN (serve per leggere/aggiornare ordini via webhook)");

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

  // 2) per documentId (orderRef)
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

  // 3) per id numerico (orderId)
  if (orderId && /^\d+$—all?/.test(orderId) === false && /^\d+$/.test(orderId)) {
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
  const idNumeric = orderRow?.id; // quasi sempre c’è
  const attrs = orderRow?.attributes ?? {};
  const documentId = orderRow?.documentId ?? attrs?.documentId ?? null;

  // 1) prova con id numerico
  if (idNumeric != null) {
    const r1 = await strapiFetch(`/api/orders/${encodeURIComponent(String(idNumeric))}`, {
      method: "PUT",
      body: JSON.stringify({ data: payload }),
    });
    if (r1.res.ok) return { ok: true, via: "id", status: r1.res.status };
    // se non ok, non ritorno: provo fallback
  }

  // 2) fallback con documentId
  if (documentId) {
    const r2 = await strapiFetch(`/api/orders/${encodeURIComponent(String(documentId))}`, {
      method: "PUT",
      body: JSON.stringify({ data: payload }),
    });
    if (r2.res.ok) return { ok: true, via: "documentId", status: r2.res.status };
    return { ok: false, status: r2.res.status, details: r2.data ?? r2.text };
  }

  return { ok: false, status: 404, details: "Missing id/documentId on orderRow" };
}

function isZeroDecimalCurrency(currency: string) {
  const zero = new Set(["BIF","CLP","DJF","GNF","JPY","KMF","KRW","MGA","PYG","RWF","UGX","VND","VUV","XAF","XOF","XPF"]);
  return zero.has(String(currency || "").toUpperCase());
}

function toMajor(amountMinor: number | null | undefined, currency: string) {
  if (typeof amountMinor !== "number" || !Number.isFinite(amountMinor)) return null;
  if (isZeroDecimalCurrency(currency)) return amountMinor;
  return amountMinor / 100;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: Request) {
  try {
    const STRIPE_SECRET_KEY = requireEnv("STRIPE_SECRET_KEY");
    const STRIPE_WEBHOOK_SECRET = requireEnv("STRIPE_WEBHOOK_SECRET");

    const sig = req.headers.get("stripe-signature");
    if (!sig) return json({ ok: false, error: "Missing stripe-signature header" }, 400);

    const rawBuf = Buffer.from(await req.arrayBuffer());

    const stripe = new Stripe(STRIPE_SECRET_KEY);

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBuf, sig, STRIPE_WEBHOOK_SECRET);
    } catch (e: any) {
      return json({ ok: false, error: "Invalid signature", details: e?.message || String(e) }, 400);
    }

    // Ignora tutto tranne checkout.session.completed
    if (event.type !== "checkout.session.completed") {
      return json({ ok: true, ignored: true, type: event.type }, 200);
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const sessionId = session.id;

    const orderRef =
      (session.metadata?.orderRef ? String(session.metadata.orderRef) : null) ||
      (session.client_reference_id ? String(session.client_reference_id) : null);

    const orderId =
      session.metadata?.orderId ? String(session.metadata.orderId) : null;

    const currency = String(session.currency || "eur").toUpperCase();

    // ✅ retry: evita race condition (ordine appena creato / stripeSessionId non ancora scritto)
    let orderRow: any = null;
    for (let i = 0; i < 6; i++) {
      orderRow = await findOrder({ sessionId, orderRef, orderId });
      if (orderRow) break;
      await sleep(250 + i * 200);
    }

    if (!orderRow) {
      // 500 così Stripe ritenta (meglio di “silenziare” e perdere l’update)
      return json(
        {
          ok: false,
          error: "Order not found on Strapi (will retry).",
          debug: {
            sessionId,
            orderRef,
            orderId,
            metadata: session.metadata ?? null,
            client_reference_id: session.client_reference_id ?? null,
          },
        },
        500
      );
    }

    // Line items (best effort)
    let items: any[] | null = null;
    try {
      const li = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 100 });
      items = (li.data || []).map((x) => {
        const qty = x.quantity ?? 0;
        const unitMinor = x.price?.unit_amount ?? null;
        const unit = toMajor(unitMinor, currency) ?? 0;
        return {
          id: x.price?.product ? String(x.price.product) : x.price?.id ? String(x.price.id) : null,
          name: x.description ?? "Articolo",
          qty,
          price: unit,
        };
      });
    } catch {
      items = null;
    }

    const subtotal = toMajor(session.amount_subtotal ?? null, currency);
    const total = toMajor(session.amount_total ?? null, currency);
    const shippingTotal = toMajor(session.total_details?.amount_shipping ?? 0, currency) ?? 0;
    const discountTotal = toMajor(session.total_details?.amount_discount ?? 0, currency) ?? 0;

    const customerEmail =
      session.customer_details?.email ??
      session.customer_email ??
      session.metadata?.customerEmail ??
      null;

    const stripePaymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : null;

    const updatePayload: any = {
      orderStatus: "PAID",
      stripeSessionId: sessionId,
      stripePaymentIntentId,
      customerEmail,
      currency,
      shippingTotal,
      discountTotal,
    };

    if (subtotal != null) updatePayload.subtotal = subtotal;
    if (total != null) updatePayload.total = total;
    if (items && items.length > 0) updatePayload.items = items;

    const upd = await updateOrderWithFallback(orderRow, updatePayload);
    if (!upd.ok) {
      // 500 => Stripe ritenta
      return json({ ok: false, error: "Failed updating order on Strapi", details: upd }, 500);
    }

    return json({ ok: true, updated: true, via: upd.via, sessionId }, 200);
  } catch (e: any) {
    console.error("[stripe/webhook] error:", e);
    return json({ ok: false, error: "Webhook error", details: e?.message || String(e) }, 500);
  }
}
