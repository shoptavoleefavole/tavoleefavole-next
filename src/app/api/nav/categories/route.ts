// src/app/api/nav/categories/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const STRAPI_URL =
  process.env.STRAPI_URL ||
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  "http://localhost:1337";

const STRAPI_TOKEN =
  process.env.STRAPI_API_TOKEN ||
  process.env.STRAPI_TOKEN ||
  process.env.NEXT_PUBLIC_STRAPI_API_TOKEN ||
  process.env.NEXT_PUBLIC_STRAPI_TOKEN;

const TIMEOUT_MS = 25000;

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function baseUrl() {
  return String(STRAPI_URL || "").replace(/\/$/, "");
}

export async function GET() {
  if (!STRAPI_URL) {
    // Mantengo status 200 come nel tuo codice per non rompere la UI
    return NextResponse.json({ data: [], error: "STRAPI_URL missing" }, { status: 200 });
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const qs = new URLSearchParams();
    qs.set("populate", "*");
    qs.set("pagination[pageSize]", "100");
    qs.set("sort[0]", "createdAt:asc");

    const url = `${baseUrl()}/api/categories?${qs.toString()}`;

    const headers: Record<string, string> = { Accept: "application/json" };
    if (STRAPI_TOKEN) headers.Authorization = `Bearer ${STRAPI_TOKEN}`;

    const res = await fetch(url, {
      headers,
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await res.text().catch(() => "");
    const json = safeJsonParse(text);

    if (!res.ok) {
      const payload =
        process.env.NODE_ENV === "production"
          ? { data: [], error: `Strapi error ${res.status}` }
          : {
              data: [],
              error: `Strapi error ${res.status}`,
              debug: text.slice(0, 600),
              usedUrl: url,
              hasToken: Boolean(STRAPI_TOKEN),
            };

      return NextResponse.json(payload, { status: 200 });
    }

    return NextResponse.json({ data: json?.data ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      {
        data: [],
        error: process.env.NODE_ENV === "production" ? "Fetch failed" : String(e?.message ?? e),
      },
      { status: 200 }
    );
  } finally {
    clearTimeout(t);
  }
}
