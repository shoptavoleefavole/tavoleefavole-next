// src/app/api/shipping/quote/route.ts
import { NextResponse } from "next/server";
import { calculateShippingQuote } from "@/lib/shipping.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShippingZone = "IT_MAINLAND" | "IT_ISLANDS";

function jsonNoStore(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "x-shipping-route": "quote",
    },
  });
}

function safeJsonParse(text: string) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function readBodySafe(req: Request) {
  const raw = await req.text().catch(() => "");
  const body = safeJsonParse(raw);
  return body && typeof body === "object" ? body : null;
}

function toIntStrict(v: any): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const s = v.trim();
    if (!/^\d+$/.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  return null;
}

function clampQty(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(999, Math.floor(n)));
}

function normalizeZone(input: any): ShippingZone {
  const z = String(input ?? "").trim().toUpperCase();
  // accetta anche il vecchio IT_ISLAND (se per errore arriva così)
  if (z === "IT_ISLANDS" || z === "IT_ISLAND") return "IT_ISLANDS";
  return "IT_MAINLAND";
}

function sanitizeItems(input: any) {
  if (!Array.isArray(input)) return [];

  const out: Array<{ productId: number; qty: number }> = [];
  for (const it of input) {
    const pid = toIntStrict(it?.productId) ?? toIntStrict(it?.id);
    if (!pid || pid <= 0) continue;

    const qty = clampQty(it?.qty);
    out.push({ productId: pid, qty });
  }

  // evita payload enormi
  return out.slice(0, 100);
}

function mapErrorToCode(message: string) {
  const m = (message || "").toLowerCase();
  if (m.includes("missing weight_grams")) return "SHIPPING_WEIGHT_MISSING";
  if (m.includes("no shipping rate")) return "SHIPPING_RATE_NOT_FOUND";
  if (m.includes("missing env")) return "SERVER_MISCONFIGURED";
  return "SHIPPING_QUOTE_FAILED";
}

export async function POST(req: Request) {
  try {
    const body = await readBodySafe(req);
    if (!body) return jsonNoStore({ ok: false, error: "INVALID_JSON" }, 400);

    const zone = normalizeZone(body?.zone ?? body?.shippingZone);
    const items = sanitizeItems(body?.items);

    if (!items.length) return jsonNoStore({ ok: false, error: "EMPTY_CART" }, 400);

    const result = await calculateShippingQuote({ items, zone });

    return jsonNoStore(
      {
        ok: true,
        zone: result.zone,
        weightTotalGrams: result.weightTotalGrams,
        shippingEur: result.shippingEur,
        deliveryTime: "24/48h",
      },
      200
    );
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    const code = mapErrorToCode(msg);

    return jsonNoStore(
      {
        ok: false,
        error: code,
        ...(process.env.NODE_ENV === "development" ? { details: msg } : {}),
      },
      400
    );
  }
}