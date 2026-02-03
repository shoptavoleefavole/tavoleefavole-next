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

async function fetchStrapi(url: string, token: string | null, signal: AbortSignal) {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers, cache: "no-store", signal });
  const text = await res.text().catch(() => "");
  const json = safeJsonParse(text);
  return { res, text, json };
}

export async function GET(req: Request) {
  const usedUrlBase = baseUrl();
  const { searchParams } = new URL(req.url);
  const debug = searchParams.get("debug") === "1";

  console.log("NAV_CATEGORIES_ENV", {
    usedUrlBase,
    hasToken: Boolean(STRAPI_TOKEN),
    tokenLen: STRAPI_TOKEN.length,
    tokenSha12: STRAPI_TOKEN ? sha12(STRAPI_TOKEN) : null,
  });

  if (!usedUrlBase) {
    return NextResponse.json({ data: [], error: "STRAPI_URL missing" }, { status: 200 });
  }

  // ✅ Query MINIMA (niente "*") per evitare icon.related
  // Navbar: label/slug + icon(url/alt/formats) + subcategories(label/slug)
  const qs = new URLSearchParams();
  qs.set("fields[0]", "label");
  qs.set("fields[1]", "slug");

  // icon (media): prendo SOLO campi necessari, niente populate "*" che tenta icon.related
  qs.set("populate[icon][fields][0]", "url");
  qs.set("populate[icon][fields][1]", "alternativeText");
  qs.set("populate[icon][fields][2]", "width");
  qs.set("populate[icon][fields][3]", "height");
  qs.set("populate[icon][fields][4]", "formats");

  // subcategories: solo label/slug
  qs.set("populate[subcategories][fields][0]", "label");
  qs.set("populate[subcategories][fields][1]", "slug");

  qs.set("pagination[pageSize]", "100");
  qs.set("sort[0]", "createdAt:asc");

  const url = `${usedUrlBase}/api/categories?${qs.toString()}`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // 1) PRIMA senza token (dato che Public find/findOne è abilitato)
    const noAuth = await fetchStrapi(url, null, controller.signal);
    if (noAuth.res.ok) {
      return NextResponse.json(
        debug
          ? { data: noAuth.json?.data ?? [], debug: { mode: "noauth", status: noAuth.res.status, usedUrl: url } }
          : { data: noAuth.json?.data ?? [] },
        { status: 200 }
      );
    }

    // 2) Se non va e hai token, prova con token (fallback per futuro se rendi private le categorie)
    if (STRAPI_TOKEN) {
      const auth = await fetchStrapi(url, STRAPI_TOKEN, controller.signal);
      if (auth.res.ok) {
        return NextResponse.json(
          debug
            ? { data: auth.json?.data ?? [], debug: { mode: "auth", status: auth.res.status, usedUrl: url } }
            : { data: auth.json?.data ?? [] },
          { status: 200 }
        );
      }

      return NextResponse.json(
        debug
          ? {
              data: [],
              error: `Strapi error ${noAuth.res.status} (noauth) + ${auth.res.status} (auth)`,
              usedUrl: url,
              noAuthBody: noAuth.text.slice(0, 800),
              authBody: auth.text.slice(0, 800),
            }
          : { data: [], error: `Strapi error ${auth.res.status}` },
        { status: 200 }
      );
    }

    // no token e noauth fallito
    return NextResponse.json(
      debug
        ? { data: [], error: `Strapi error ${noAuth.res.status}`, usedUrl: url, body: noAuth.text.slice(0, 800) }
        : { data: [], error: `Strapi error ${noAuth.res.status}` },
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
