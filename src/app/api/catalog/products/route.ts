import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRAPI_URL =
  process.env.STRAPI_URL ||
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  "http://localhost:1337";

const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || "";

function baseUrl() {
  return String(STRAPI_URL || "").trim().replace(/\/$/, "");
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function GET() {
  const usedUrlBase = baseUrl();
  if (!usedUrlBase) {
    return NextResponse.json({ data: [], error: "STRAPI_URL missing" }, { status: 200 });
  }

  const qs = new URLSearchParams();
  qs.set("pagination[pageSize]", "200");
  qs.set("sort[0]", "createdAt:desc");

  // campi base
  qs.set("fields[0]", "name");
  qs.set("fields[1]", "slug");
  qs.set("fields[2]", "price");
  qs.set("fields[3]", "compareAtPrice");
  qs.set("fields[4]", "shortDescription");

  // ✅ inventario
  qs.set("fields[5]", "stockQty");
  qs.set("fields[6]", "trackInventory");

  // immagini: solo url (leggero)
  qs.set("populate[images][fields][0]", "url");

  const url = `${usedUrlBase}/api/products?${qs.toString()}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (STRAPI_API_TOKEN) headers.Authorization = `Bearer ${STRAPI_API_TOKEN}`;

  const res = await fetch(url, {
    headers,
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  const json = safeJsonParse(text);

  if (!res.ok) {
    return NextResponse.json(
      { data: [], error: `Strapi error ${res.status}`, details: json?.error ?? null },
      { status: 200 }
    );
  }

  return NextResponse.json({ data: json?.data ?? [], meta: json?.meta ?? {} }, { status: 200 });
}
