// src/app/api/nav/categories/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ✅ Fail-safe goals:
 * - Mai 500: risponde sempre 200 con { data: [...] }
 * - Timeout corto: non blocca UI quando Strapi è down/cold-start
 * - Cache in memoria + stale: se Strapi cade, serviamo l’ultima lista valida
 * - Output normalizzato: {slug,label,icon,subcategories[]} -> Header compatibile
 * - Fallback categorie: menu sempre navigabile anche senza Strapi
 */

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

const STRAPI_TOKEN = String(STRAPI_TOKEN_RAW || "").trim();

// ⏱️ più basso = UI più reattiva. Se Render è in cold start, preferiamo fallback.
const TIMEOUT_MS = Number(process.env.NAV_CATEGORIES_TIMEOUT_MS ?? 5500);

// Cache: 60s “fresh”, 10 min “stale”
const CACHE_TTL_MS = 60_000;
const STALE_TTL_MS = 10 * 60_000;

type NavSub = { slug: string; label: string };
type NavCat = { slug: string; label: string; icon: string | null; subcategories: NavSub[] };

const FALLBACK_CATEGORIES: NavCat[] = [
  { slug: "prodotti-per-pasticceria", label: "Prodotti per pasticceria", icon: null, subcategories: [] },
  { slug: "decorazioni-per-dolci", label: "Decorazioni per dolci", icon: null, subcategories: [] },
  { slug: "confetti", label: "Confetti", icon: null, subcategories: [] },
];

type CacheEntry = { data: NavCat[]; fetchedAt: number };

// Cache in memoria (best-effort: su serverless può resettarsi)
let memCache: CacheEntry | null = null;

// Anti-stampede: se arrivano richieste in parallelo, facciamo 1 sola fetch a Strapi
let inflight: Promise<NavCat[] | null> | null = null;

function nowMs() {
  return Date.now();
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function baseUrl() {
  return String(STRAPI_URL || "").trim().replace(/\/+$/, "");
}

function absUrl(base: string, maybeUrl: string | null | undefined) {
  if (!maybeUrl) return null;
  const u = String(maybeUrl).trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${base.replace(/\/$/, "")}${u}`;
  return u;
}

function safeString(v: unknown, fallback = "") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function isFresh(entry: CacheEntry) {
  return nowMs() - entry.fetchedAt < CACHE_TTL_MS;
}

function isStaleAllowed(entry: CacheEntry) {
  return nowMs() - entry.fetchedAt < STALE_TTL_MS;
}

function json200(payload: any, extraHeaders?: Record<string, string>) {
  // ✅ caching CDN/browser (utile su Vercel/edge)
  return NextResponse.json(payload, {
    status: 200,
    headers: {
      // CDN: 60s fresh + 10 min stale
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600, max-age=60",
      ...extraHeaders,
    },
  });
}

async function fetchStrapi(url: string, token: string | null, signal: AbortSignal) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers, cache: "no-store", signal });
  const text = await res.text().catch(() => "");
  const json = text ? safeJsonParse(text) : null;

  return { ok: res.ok, status: res.status, text, json };
}

function normalizeCategoryRow(row: any, usedUrlBase: string): NavCat | null {
  // Strapi v4/v5: { id, attributes: {...} } oppure già normalizzato {slug,label,...}
  const a = row?.attributes ?? row ?? {};
  const slug = safeString(a?.slug);
  if (!slug) return null;

  const label = safeString(a?.label ?? a?.name ?? a?.title, slug);

  // icon: accetta sia media strapi sia stringa già pronta
  const iconRaw =
    a?.icon?.data?.attributes?.url ??
    a?.icon?.attributes?.url ??
    a?.icon?.url ??
    a?.iconUrl ??
    a?.icon ??
    null;

  const icon = iconRaw ? absUrl(usedUrlBase, iconRaw) : null;

  // subcategories: Strapi relation oppure già array di {slug,label}
  const subsData = a?.subcategories?.data ?? a?.subcategories ?? [];
  const subsArr = Array.isArray(subsData) ? subsData : [];

  const subcategories: NavSub[] = subsArr
    .map((s: any) => {
      const sa = s?.attributes ?? s ?? {};
      const sSlug = safeString(sa?.slug);
      if (!sSlug) return null;
      const sLabel = safeString(sa?.label ?? sa?.name ?? sa?.title, sSlug);
      return { slug: sSlug, label: sLabel };
    })
    .filter(Boolean) as NavSub[];

  return { slug, label, icon, subcategories };
}

function normalizeCategories(rawData: any, usedUrlBase: string): NavCat[] {
  const arr: any[] = Array.isArray(rawData) ? rawData : [];
  const out: NavCat[] = [];

  for (const row of arr) {
    const n = normalizeCategoryRow(row, usedUrlBase);
    if (n) out.push(n);
  }

  // dedupe per slug (difesa)
  const seen = new Set<string>();
  const deduped: NavCat[] = [];
  for (const c of out) {
    if (seen.has(c.slug)) continue;
    seen.add(c.slug);
    deduped.push(c);
  }

  return deduped;
}

async function loadFromStrapi(url: string, usedUrlBase: string, debug: boolean) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // 1) prima senza token (public)
    const noAuth = await fetchStrapi(url, null, controller.signal);
    if (noAuth.ok) {
      const dataRaw = Array.isArray(noAuth.json?.data) ? noAuth.json.data : [];
      const data = normalizeCategories(dataRaw, usedUrlBase);
      return { data, mode: "noauth" as const, status: noAuth.status, errText: "" };
    }

    // 2) fallback con token (se presente)
    if (STRAPI_TOKEN) {
      const auth = await fetchStrapi(url, STRAPI_TOKEN, controller.signal);
      if (auth.ok) {
        const dataRaw = Array.isArray(auth.json?.data) ? auth.json.data : [];
        const data = normalizeCategories(dataRaw, usedUrlBase);
        return { data, mode: "auth" as const, status: auth.status, errText: "" };
      }

      return {
        data: null as NavCat[] | null,
        mode: "error" as const,
        status: auth.status,
        errText: debug ? `${noAuth.status} noauth / ${auth.status} auth :: ${auth.text.slice(0, 400)}` : "",
      };
    }

    return {
      data: null as NavCat[] | null,
      mode: "error" as const,
      status: noAuth.status,
      errText: debug ? noAuth.text.slice(0, 400) : "",
    };
  } catch (e: any) {
    const isAbort = e?.name === "AbortError";
    return {
      data: null as NavCat[] | null,
      mode: isAbort ? ("timeout" as const) : ("fetch_failed" as const),
      status: isAbort ? 504 : 500,
      errText: debug ? String(e?.message ?? e) : "",
    };
  } finally {
    clearTimeout(t);
  }
}

async function getCategories(url: string, usedUrlBase: string, debug: boolean) {
  // 1) cache fresh
  if (memCache && isFresh(memCache)) {
    return { data: memCache.data, source: "cache_fresh" as const };
  }

  // 2) inflight (anti-stampede)
  if (!inflight) {
    inflight = (async () => {
      const r = await loadFromStrapi(url, usedUrlBase, debug);

      if (Array.isArray(r.data)) {
        // ✅ se Strapi risponde anche con array vuoto, lo consideriamo valido (può essere voluto)
        memCache = { data: r.data, fetchedAt: nowMs() };
        return r.data;
      }

      // se fallisce, NON sovrascriviamo cache
      return null;
    })().finally(() => {
      inflight = null;
    });
  }

  const fetched = await inflight;

  // 3) successo
  if (Array.isArray(fetched)) return { data: fetched, source: "strapi" as const };

  // 4) fallback a cache stale se disponibile
  if (memCache && isStaleAllowed(memCache)) return { data: memCache.data, source: "cache_stale" as const };

  // 5) fallback finale: categorie statiche
  return { data: [...FALLBACK_CATEGORIES], source: "fallback" as const };
}

export async function GET(req: Request) {
  try {
    const usedUrlBase = baseUrl();
    const { searchParams } = new URL(req.url);
    const debug = searchParams.get("debug") === "1";

    // Se manca base URL => fallback secco
    if (!usedUrlBase) {
      return json200(
        debug
          ? { data: [...FALLBACK_CATEGORIES], debug: { source: "fallback", reason: "STRAPI_URL missing" } }
          : { data: [...FALLBACK_CATEGORIES] }
      );
    }

    // Query MINIMA: label/slug + icon(fields) + subcategories(fields)
    const qs = new URLSearchParams();
    qs.set("fields[0]", "label");
    qs.set("fields[1]", "slug");

    // icon: SOLO campi necessari
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

    const { data, source } = await getCategories(url, usedUrlBase, debug);

    // ✅ Risposta sempre 200 + header utile debug (non rompe nulla)
    return json200(
      debug
        ? {
            data,
            debug: {
              source,
              usedUrl: url,
              timeoutMs: TIMEOUT_MS,
              hasToken: Boolean(STRAPI_TOKEN),
              cacheAgeMs: memCache ? nowMs() - memCache.fetchedAt : null,
            },
          }
        : { data },
      {
        "X-Nav-Source": source,
      }
    );
  } catch {
    // Ultima difesa: mai 500
    return json200({ data: [...FALLBACK_CATEGORIES] }, { "X-Nav-Source": "fallback_error" });
  }
}
