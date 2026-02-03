import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

const STRAPI_URL =
  process.env.STRAPI_URL ||
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  "http://localhost:1337";

const STRAPI_TOKEN_RAW =
  process.env.STRAPI_API_TOKEN ||
  process.env.STRAPI_TOKEN ||
  process.env.NEXT_PUBLIC_STRAPI_API_TOKEN ||
  process.env.NEXT_PUBLIC_STRAPI_TOKEN ||
  "";

const STRAPI_TOKEN = STRAPI_TOKEN_RAW.trim();

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

function sha12(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);
}

async function fetchStrapi(url: string, withAuth: boolean, signal: AbortSignal) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    // (facoltativo ma utile se c’è qualche filtro lato rete/UA)
    "User-Agent": "Mozilla/5.0 (Vercel; Next.js server)",
  };

  if (withAuth && STRAPI_TOKEN) {
    headers.Authorization = `Bearer ${STRAPI_TOKEN}`;
  }

  const res = await fetch(url, { headers, cache: "no-store", signal });
  const text = await res.text().catch(() => "");
  const json = safeJsonParse(text);

  return { res, text, json };
}

export async function GET(req: Request) {
  const usedUrlBase = baseUrl();
  const { searchParams } = new URL(req.url);
  const debug = searchParams.get("debug") === "1";

  // Log “sicuro” (nessun token)
  console.log("NAV_CATEGORIES_ENV", {
    usedUrlBase,
    hasToken: Boolean(STRAPI_TOKEN),
    tokenLen: STRAPI_TOKEN.length,
    tokenSha12: STRAPI_TOKEN ? sha12(STRAPI_TOKEN) : null,
  });

  if (!usedUrlBase) {
    return NextResponse.json({ data: [], error: "STRAPI_URL missing" }, { status: 200 });
  }

  // ✅ Richiesta MINIMA per navbar (niente populate=*)
  // - fields: solo label/slug
  // - populate: solo icon e subcategories (niente products)
  const qs = new URLSearchParams();
  qs.set("fields[0]", "label");
  qs.set("fields[1]", "slug");
  qs.set("populate[icon]", "*");
  qs.set("populate[subcategories]", "*");
  qs.set("pagination[pageSize]", "100");
  qs.set("sort[0]", "createdAt:asc");

  const url = `${usedUrlBase}/api/categories?${qs.toString()}`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // 1) tenta con token
    const a = await fetchStrapi(url, true, controller.signal);

    // 2) se 401/403, fallback senza token (dato che Public è abilitato)
    if ((a.res.status === 401 || a.res.status === 403) && STRAPI_TOKEN) {
      const b = await fetchStrapi(url, false, controller.signal);

      if (b.res.ok) {
        return NextResponse.json(
          debug
            ? { data: b.json?.data ?? [], debug: { firstStatus: a.res.status, fallbackStatus: b.res.status } }
            : { data: b.json?.data ?? [] },
          { status: 200 }
        );
      }

      // entrambi falliti
      return NextResponse.json(
        debug
          ? {
              data: [],
              error: `Strapi error ${a.res.status} (auth) + ${b.res.status} (noauth)`,
              usedUrl: url,
              authBody: a.text.slice(0, 800),
              noAuthBody: b.text.slice(0, 800),
              wwwAuthAuth: a.res.headers.get("www-authenticate"),
              wwwAuthNoAuth: b.res.headers.get("www-authenticate"),
            }
          : { data: [], error: `Strapi error ${a.res.status}` },
        { status: 200 }
      );
    }

    // se ok al primo colpo
    if (a.res.ok) {
      return NextResponse.json({ data: a.json?.data ?? [] }, { status: 200 });
    }

    // fallito (non 401/403 o senza token)
    return NextResponse.json(
      debug
        ? {
            data: [],
            error: `Strapi error ${a.res.status}`,
            usedUrl: url,
            body: a.text.slice(0, 800),
            wwwAuth: a.res.headers.get("www-authenticate"),
          }
        : { data: [], error: `Strapi error ${a.res.status}` },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: [], error: debug ? String(e?.message ?? e) : "Fetch failed" },
      { status: 200 }
    );
  } finally {
    clearTimeout(t);
  }
}
