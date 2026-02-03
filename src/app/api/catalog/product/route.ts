import { NextResponse } from "next/server";

export const runtime = "nodejs";

const STRAPI_URL =
  process.env.STRAPI_URL ||
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  "http://localhost:1337";

function baseUrl() {
  return String(STRAPI_URL || "").trim().replace(/\/$/, "");
}

function safeJsonParse(text: string) {
  try { return JSON.parse(text); } catch { return null; }
}

export async function GET(req: Request) {
  const usedUrlBase = baseUrl();
  if (!usedUrlBase) {
    return NextResponse.json({ data: null, error: "STRAPI_URL missing" }, { status: 200 });
  }

  const { searchParams } = new URL(req.url);
  const slug = (searchParams.get("slug") || "").trim();
  if (!slug) {
    return NextResponse.json({ data: null, error: "missing slug" }, { status: 200 });
  }

  const qs = new URLSearchParams();
  qs.set("filters[slug][$eq]", slug);
  qs.set("populate", "*");

  const url = `${usedUrlBase}/api/products?${qs.toString()}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  const json = safeJsonParse(text);

  if (!res.ok) {
    return NextResponse.json({ data: null, error: `Strapi error ${res.status}` }, { status: 200 });
  }

  const first = Array.isArray(json?.data) ? json.data[0] : null;
  return NextResponse.json({ data: first }, { status: 200 });
}
