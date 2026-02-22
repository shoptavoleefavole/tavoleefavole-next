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
  // accetta anche IT_ISLAND per compatibilità
  if (z === "IT_ISLANDS" || z === "IT_ISLAND") return "IT_ISLANDS";
  return "IT_MAINLAND";
}

function sanitizeSlug(v: any) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  // slug safe (evita payload strani)
  if (!/^[a-z0-9-]{2,120}$/i.test(s)) return null;
  return s;
}

function sanitizeItems(input: any) {
  if (!Array.isArray(input)) return { byId: [] as Array<{ productId: number; qty: number }>, slugs: [] as string[] };

  const byId: Array<{ productId: number; qty: number }> = [];
  const slugs: string[] = [];

  for (const it of input) {
    const qty = clampQty(it?.qty);
    const pid = toIntStrict(it?.productId) ?? toIntStrict(it?.id);

    if (pid && pid > 0) {
      byId.push({ productId: pid, qty });
      continue;
    }

    const slug = sanitizeSlug(it?.slug);
    if (slug) slugs.push(slug);
  }

  return {
    byId: byId.slice(0, 100),
    slugs: Array.from(new Set(slugs)).slice(0, 100),
  };
}

function pickStrapiBaseUrl() {
  const raw = process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "";
  return String(raw).replace(/\/+$/, "");
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 12_000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

async function resolveProductIdsBySlugs(args: { slugs: string[] }) {
  const STRAPI_URL = pickStrapiBaseUrl();
  const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || "";

  if (!STRAPI_URL) throw new Error("Missing env: STRAPI_URL");
  if (!STRAPI_API_TOKEN || STRAPI_API_TOKEN.length < 20) throw new Error("Missing env: STRAPI_API_TOKEN");

  const qs = new URLSearchParams();
  qs.set("pagination[pageSize]", "100");
  args.slugs.forEach((s, i) => qs.append(`filters[slug][$in][${i}]`, s));
  qs.append("fields[0]", "id");
  qs.append("fields[1]", "slug");

  const url = `${STRAPI_URL}/api/products?${qs.toString()}`;

  const res = await fetchWithTimeout(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
  });

  if (!res.ok) throw new Error(`Strapi products lookup failed (${res.status})`);

  const data = await res.json().catch(() => null);
  const arr = Array.isArray(data?.data) ? data.data : [];

  const map = new Map<string, number>();
  for (const row of arr) {
    const id = typeof row?.id === "number" ? row.id : null;
    const slug = typeof row?.attributes?.slug === "string" ? row.attributes.slug : typeof row?.slug === "string" ? row.slug : null;
    if (id && slug) map.set(String(slug), id);
  }

  return map;
}

function mapErrorToCode(message: string) {
  const m = (message || "").toLowerCase();
  if (m.includes("missing weight_grams")) return "SHIPPING_WEIGHT_MISSING";
  if (m.includes("no shipping rate")) return "SHIPPING_RATE_NOT_FOUND";
  if (m.includes("missing env")) return "SERVER_MISCONFIGURED";
  if (m.includes("lookup failed")) return "STRAPI_LOOKUP_FAILED";
  return "SHIPPING_QUOTE_FAILED";
}

export async function POST(req: Request) {
  try {
    const body = await readBodySafe(req);
    if (!body) return jsonNoStore({ ok: false, error: "INVALID_JSON" }, 400);

    const zone = normalizeZone(body?.zone ?? body?.shippingZone);

    const { byId, slugs } = sanitizeItems(body?.items);

    let items: Array<{ productId: number; qty: number }> = [...byId];

    // fallback professionale: se non ho ID, risolvo via slug su Strapi
    if (!items.length && slugs.length) {
      const map = await resolveProductIdsBySlugs({ slugs });
      items = slugs
        .map((s) => map.get(s))
        .filter((id): id is number => typeof id === "number" && id > 0)
        .map((productId) => {
          const original = (body.items as any[]).find((x) => String(x?.slug ?? "").trim() === String(productId));
          const qty = clampQty(original?.qty);
          return { productId, qty };
        });

      // se sopra non trova qty (perché original non matcha), facciamo qty=1
      if (!items.length) {
        items = slugs
          .map((s) => map.get(s))
          .filter((id): id is number => typeof id === "number" && id > 0)
          .map((productId) => ({ productId, qty: 1 }));
      }
    }

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