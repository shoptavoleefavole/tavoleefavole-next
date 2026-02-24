// src/app/api/nav/occasions/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ✅ Fail-safe goals (come /nav/categories):
 * - Mai 500: risponde sempre 200 con { data: [...] }
 * - Timeout corto: UI reattiva anche se Strapi è down/cold-start
 * - Cache in memoria + stale: se Strapi cade, serviamo ultima lista valida
 * - Output normalizzato: {slug,label} -> Navbar compatibile
 *
 * ✅ LOGICA VISIBILITÀ (richiesta):
 * Mostra un’occasione SOLO se:
 * - isActive === true
 *   OPPURE
 * - oggi è tra startDate e endDate (inclusi)
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

const TIMEOUT_MS = Number(process.env.NAV_OCCASIONS_TIMEOUT_MS ?? 4500);

// Cache: 60s “fresh”, 10 min “stale”
const CACHE_TTL_MS = 60_000;
const STALE_TTL_MS = 10 * 60_000;

type NavOcc = { slug: string; label: string };

type CacheEntry = { data: NavOcc[]; fetchedAt: number };

// Cache in memoria (best-effort: su serverless può resettarsi)
let memCache: CacheEntry | null = null;

// Anti-stampede
let inflight: Promise<NavOcc[] | null> | null = null;

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
  return NextResponse.json(payload, {
    status: 200,
    headers: {
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

/**
 * Oggi in formato YYYY-MM-DD in Europe/Rome (evita sfasamenti UTC).
 */
function todayYMD_Rome() {
  try {
    // en-CA => YYYY-MM-DD
    const s = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    return s; // YYYY-MM-DD
  } catch {
    // fallback UTC
    return new Date().toISOString().slice(0, 10);
  }
}

function isActiveByDateOrFlag(a: any) {
  const isActive = Boolean(a?.isActive === true);

  const start = safeString(a?.startDate, "");
  const end = safeString(a?.endDate, "");
  const today = todayYMD_Rome();

  if (isActive) return true;

  // Se non hai date -> non mostrare (coerente con “solo in determinati giorni”)
  if (!start && !end) return false;

  // start solo
  if (start && !end) return today >= start;

  // end solo
  if (!start && end) return today <= end;

  // entrambi
  return today >= start && today <= end;
}

function normalizeOccasionRow(row: any): NavOcc | null {
  const a = row?.attributes ?? row ?? {};

  const slug = safeString(a?.slug, "");
  if (!slug) return null;

  // Titolo può essere "Titolo" oppure "titolo" (dipende da come l’hai chiamato)
  const label = safeString(a?.Titolo ?? a?.titolo ?? a?.title ?? a?.label ?? a?.name, slug);

  if (!isActiveByDateOrFlag(a)) return null;

  return { slug, label };
}

function normalizeOccasions(rawData: any): NavOcc[] {
  const arr: any[] = Array.isArray(rawData) ? rawData : [];
  const out: NavOcc[] = [];

  for (const row of arr) {
    const n = normalizeOccasionRow(row);
    if (n) out.push(n);
  }

  // dedupe + sort stabile (prima per startDate se presente, poi label)
  const seen = new Set<string>();
  const deduped: NavOcc[] = [];
  for (const o of out) {
    if (seen.has(o.slug)) continue;
    seen.add(o.slug);
    deduped.push(o);
  }

  return deduped;
}

async function loadFromStrapi(url: string, debug: boolean) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // 1) no-auth
    const noAuth = await fetchStrapi(url, null, controller.signal);
    if (noAuth.ok) {
      const dataRaw = Array.isArray(noAuth.json?.data) ? noAuth.json.data : [];
      const data = normalizeOccasions(dataRaw);
      return { data, mode: "noauth" as const, status: noAuth.status, errText: "" };
    }

    // 2) auth (se token)
    if (STRAPI_TOKEN) {
      const auth = await fetchStrapi(url, STRAPI_TOKEN, controller.signal);
      if (auth.ok) {
        const dataRaw = Array.isArray(auth.json?.data) ? auth.json.data : [];
        const data = normalizeOccasions(dataRaw);
        return { data, mode: "auth" as const, status: auth.status, errText: "" };
      }

      return {
        data: null as NavOcc[] | null,
        mode: "error" as const,
        status: auth.status,
        errText: debug ? `${noAuth.status} noauth / ${auth.status} auth :: ${auth.text.slice(0, 400)}` : "",
      };
    }

    return {
      data: null as NavOcc[] | null,
      mode: "error" as const,
      status: noAuth.status,
      errText: debug ? noAuth.text.slice(0, 400) : "",
    };
  } catch (e: any) {
    const isAbort = e?.name === "AbortError";
    return {
      data: null as NavOcc[] | null,
      mode: isAbort ? ("timeout" as const) : ("fetch_failed" as const),
      status: isAbort ? 504 : 500,
      errText: debug ? String(e?.message ?? e) : "",
    };
  } finally {
    clearTimeout(t);
  }
}

async function getOccasions(url: string, debug: boolean) {
  // 1) cache fresh
  if (memCache && isFresh(memCache)) {
    return { data: memCache.data, source: "cache_fresh" as const };
  }

  // 2) inflight anti-stampede
  if (!inflight) {
    inflight = (async () => {
      const r = await loadFromStrapi(url, debug);
      if (Array.isArray(r.data)) {
        memCache = { data: r.data, fetchedAt: nowMs() };
        return r.data;
      }
      return null;
    })().finally(() => {
      inflight = null;
    });
  }

  const fetched = await inflight;

  // 3) ok
  if (Array.isArray(fetched)) return { data: fetched, source: "strapi" as const };

  // 4) cache stale
  if (memCache && isStaleAllowed(memCache)) return { data: memCache.data, source: "cache_stale" as const };

  // 5) fallback: nessuna occasione (meglio che mostrare roba fuori periodo)
  return { data: [] as NavOcc[], source: "fallback" as const };
}

export async function GET(req: Request) {
  try {
    const usedUrlBase = baseUrl();
    const { searchParams } = new URL(req.url);
    const debug = searchParams.get("debug") === "1";

    if (!usedUrlBase) {
      return json200(debug ? { data: [], debug: { source: "fallback", reason: "STRAPI_URL missing" } } : { data: [] }, {
        "X-Nav-Source": "fallback",
      });
    }

    // Query “safe”: NON settiamo fields, così prendiamo anche Titolo/titolo senza rischiare mismatch.
    const qs = new URLSearchParams();
    qs.set("pagination[pageSize]", "100");
    qs.set("sort[0]", "startDate:asc");
    qs.set("sort[1]", "createdAt:asc");

    const url = `${usedUrlBase}/api/occasions?${qs.toString()}`;

    const { data, source } = await getOccasions(url, debug);

    return json200(
      debug
        ? {
            data,
            debug: {
              source,
              usedUrl: url,
              timeoutMs: TIMEOUT_MS,
              hasToken: Boolean(STRAPI_TOKEN),
              todayRome: todayYMD_Rome(),
              cacheAgeMs: memCache ? nowMs() - memCache.fetchedAt : null,
            },
          }
        : { data },
      { "X-Nav-Source": source }
    );
  } catch {
    return json200({ data: [] }, { "X-Nav-Source": "fallback_error" });
  }
}