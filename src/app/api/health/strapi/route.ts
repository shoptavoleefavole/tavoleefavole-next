import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FETCH_TIMEOUT_MS = Number(process.env.HEALTH_STRAPI_TIMEOUT_MS ?? 5000);

function pickBaseUrl() {
  const raw =
    process.env.STRAPI_URL ||
    process.env.NEXT_PUBLIC_STRAPI_URL ||
    "http://localhost:1337";

  let base = String(raw).trim().replace(/\/+$/, "");

  const isLocal =
    base.includes("localhost") ||
    base.includes("127.0.0.1") ||
    base.includes("0.0.0.0");

  // in prod evita localhost
  if (process.env.NODE_ENV === "production" && isLocal) return "";

  // in prod prova https se non local
  if (process.env.NODE_ENV === "production" && !isLocal) {
    base = base.replace(/^http:\/\//i, "https://");
  }

  return base;
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

async function tryFetch(url: string, headers: HeadersInit) {
  try {
    const res = await fetchWithTimeout(url, { headers });
    const text = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, textPreview: text.slice(0, 200) };
  } catch (e: any) {
    const isAbort = e?.name === "AbortError";
    return { ok: false, status: isAbort ? 504 : 0, textPreview: isAbort ? "timeout" : String(e?.message || "fetch failed") };
  }
}

export async function GET() {
  const baseUrl = pickBaseUrl();
  const token =
    process.env.STRAPI_API_TOKEN ||
    process.env.STRAPI_TOKEN ||
    process.env.NEXT_PUBLIC_STRAPI_API_TOKEN ||
    process.env.NEXT_PUBLIC_STRAPI_TOKEN ||
    "";

  if (!baseUrl) {
    return NextResponse.json(
      {
        ok: false,
        reason: "STRAPI_URL invalid (prod localhost?)",
        nodeEnv: process.env.NODE_ENV,
        baseUrl,
        tokenPresent: Boolean(token),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // ping leggero
  const pingUrl = `${baseUrl}/api/categories?pagination[pageSize]=1`;

  const noAuth = await tryFetch(pingUrl, { Accept: "application/json" });
  const withAuth = token
    ? await tryFetch(pingUrl, { Accept: "application/json", Authorization: `Bearer ${token}` })
    : null;

  return NextResponse.json(
    {
      ok: true,
      nodeEnv: process.env.NODE_ENV,
      baseUrl,
      tokenPresent: Boolean(token),
      ping: {
        url: pingUrl,
        noAuth,
        withAuth,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
