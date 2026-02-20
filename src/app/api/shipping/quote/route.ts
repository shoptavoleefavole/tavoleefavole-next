// src/app/api/shipping/quote/route.ts
import { NextResponse } from "next/server";
import { calculateShippingQuote } from "@/lib/shipping.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const items = Array.isArray(body?.items) ? body.items : [];
    const zone = body?.zone === "IT_ISLANDS" ? "IT_ISLANDS" : "IT_MAINLAND";

    const result = await calculateShippingQuote({ items, zone });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Shipping quote error" },
      { status: 400 }
    );
  }
}