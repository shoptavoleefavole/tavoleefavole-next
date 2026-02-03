import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

const STRAPI_URL =
  process.env.STRAPI_URL ||
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  "http://localhost:1337";

const TIMEOUT_MS = 25000;

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function baseUrl() {
  return String(STRAPI_URL || "").trim().replace(/\/$/, "");
}

function sha12(s: string | null) {
  if (!s) return null;
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);
}

function resolveToken() {
  const raw =
    process.env.STRAPI_API_TOKEN ||
    process.env.STRAPI_TOKEN ||
    process.env.NEXT_PUBLIC_STRAPI_API_TOKEN ||
    process.env.NEXT_PUBLIC_STRAPI_TOKEN ||
    "";

  const source =
    process.env.STRAPI_API_TOKEN
      ? "STRAPI_API_TOKEN"
      : process.env.STRAPI_TOKEN
        ? "STRAPI_TOKEN"
        : process.env.NEXT_PUBLIC_STRAPI_API_TOKEN
          ? "NEXT_PUBLIC_STRAPI_API_TOKEN"
          : process.env.NEXT_PUBLIC_STRAPI_TOKEN
            ? "NEXT_PUBLIC_STRAPI_TOKEN"
            : "none";

  const trimmed = raw.trim();

  return {
    source,
    rawLen: raw.length,
    trimmedLen: trimmed.length,
    rawSha12: sha12(raw || null),
    trimmedSha12: sha12(trimmed || null),
    token: trimmed.length ? trimmed : null,
  };
}

export async function GET() {
  const usedUrlBase = baseUrl();
  const tok = resolveToken();

  // LOG sicuro (nessun valore sensibile)
  console.log("NAV_CATEGORIES_ENV", {
    usedUrlBase,
    tokenSource: tok.source,
    rawLen: tok.rawLen,
    trimmedLen: tok.trimmedLen,
    rawSha12: tok.rawSha12,
    trimmedSha12: tok.trimmedSha12,
  });

  // Nota: mantengo status 200 per non rompere la UI
  if (!usedUrlBase) {
    return NextResponse.json({ data: [], error: "STRAPI_URL missing" }, { status: 200 });
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const qs = new URLSearchParams();
    qs.set("populate", "*");
    qs.set("pagination[pageSize]", "100");
    qs.set("sort[0]", "createdAt:asc");

    const url = `${usedUrlBase}/api/categories?${qs.toString()}`;

    const headers: Record<string, string> = { Accept: "application/json" };
    if (tok.token) headers.Authorization = `Bearer ${tok.token}`;

    const res = await fetch(url, {
      headers,
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await res.text().catch(() => "");
    const json = safeJsonParse(text);

    if (!res.ok) {
      // In produzione non esporre dettagli (mantengo il tuo approccio)
      const payload =
        process.env.NODE_ENV === "production"
          ? { data: [], error: `Strapi error ${res.status}` }
          : {
              data: [],
              error: `Strapi error ${res.status}`,
              debug: text.slice(0, 600),
              usedUrl: url,
              wwwAuth: res.headers.get("www-authenticate"),
              tokenSource: tok.source,
              trimmedLen: tok.trimmedLen,
              trimmedSha12: tok.trimmedSha12,
            };

      return NextResponse.json(payload, { status: 200 });
    }

    return NextResponse.json({ data: json?.data ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { data: [], error: process.env.NODE_ENV === "production" ? "Fetch failed" : String(e?.message ?? e) },
      { status: 200 }
    );
  } finally {
    clearTimeout(t);
  }
}
