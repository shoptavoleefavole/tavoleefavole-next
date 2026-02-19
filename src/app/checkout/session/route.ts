import Stripe from "stripe";
import { NextResponse } from "next/server";

import { getProductById, getProductBySlug } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

type CartItemIn = {
  id: string; // documentId o id o slug (come fai già nel ProductPage)
  slug?: string;
  qty: number;
};

type AddressIn = {
  label?: string;
  fullName?: string;
  phone?: string;
  street?: string;
  cap?: string;
  city?: string;
  province?: string;
  country?: string;
};

function toIntQty(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

function toCents(priceMajor: number) {
  const n = Number(priceMajor);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

function safeStr(v: unknown, max = 250) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max) : s;
}

function compactAddress(a?: AddressIn | null) {
  if (!a) return "";
  const parts = [
    safeStr(a.fullName, 80),
    safeStr(a.phone, 40),
    safeStr(a.street, 120),
    `${safeStr(a.cap, 20)} ${safeStr(a.city, 60)} ${safeStr(a.province, 20)}`.trim(),
    safeStr(a.country, 40),
    safeStr(a.label, 40),
  ].filter(Boolean);

  // Stripe metadata max 500 chars per value
  const s = parts.join(" | ");
  return s.length > 480 ? s.slice(0, 480) : s;
}

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Stripe non configurato: manca STRIPE_SECRET_KEY" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);

    const itemsIn: CartItemIn[] = Array.isArray(body?.items) ? body.items : [];
    const address: AddressIn | null = body?.address && typeof body.address === "object" ? body.address : null;

    if (!itemsIn.length) {
      return NextResponse.json({ error: "Carrello vuoto" }, { status: 400 });
    }

    // Carica e valida prodotti da Strapi (source of truth)
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    for (const it of itemsIn) {
      const id = safeStr(it?.id, 120);
      const qty = toIntQty(it?.qty);

      if (!id || qty < 1) {
        return NextResponse.json({ error: "Item non valido" }, { status: 400 });
      }

      // 1) tenta per id (documentId / id numerico / slug fallback interno)
      let p: any = await getProductById(id);

      // 2) ulteriore fallback: slug (se passato)
      if (!p && it?.slug) p = await getProductBySlug(String(it.slug));

      if (!p) {
        return NextResponse.json({ error: `Prodotto non trovato (${id})` }, { status: 404 });
      }

      const price = Number(p?.price ?? 0);
      const unitAmount = toCents(price);
      if (unitAmount <= 0) {
        return NextResponse.json(
          { error: `Prodotto non acquistabile: ${p?.name ?? p?.slug ?? id}` },
          { status: 400 }
        );
      }

      // Stock check (solo se trackInventory true e stockQty numero)
      const trackInventory =
        typeof p?.trackInventory === "boolean" ? p.trackInventory : null;
      const stockQty =
        typeof p?.stockQty === "number" && Number.isFinite(p.stockQty) ? p.stockQty : null;

      if (trackInventory === true && typeof stockQty === "number") {
        if (qty > stockQty) {
          return NextResponse.json(
            {
              error: `Quantità non disponibile per "${p?.name}". Disponibili: ${stockQty}`,
              code: "OUT_OF_STOCK",
              product: { slug: p?.slug, name: p?.name, stockQty },
            },
            { status: 409 }
          );
        }
      }

      const name = safeStr(p?.name ?? p?.slug ?? "Prodotto", 120);

      lineItems.push({
        quantity: qty,
        price_data: {
          currency: "eur",
          unit_amount: unitAmount,
          product_data: {
            name,
            // images: p?.image ? [String(p.image)] : undefined, // opzionale
          },
        },
      });
    }

    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "";
    const baseUrl = origin || process.env.NEXT_PUBLIC_SITE_URL || "";

    const successUrl = `${baseUrl.replace(/\/$/, "")}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl.replace(/\/$/, "")}/checkout/cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      // raccolta email per ricevuta se guest
      customer_email: body?.email ? safeStr(body.email, 120) : undefined,
      allow_promotion_codes: true,

      // Metadata (leggera e sicura)
      metadata: {
        address: compactAddress(address),
        source: "tavoleefavole-next",
      },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Errore creazione checkout", detail: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
