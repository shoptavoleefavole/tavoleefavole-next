import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REGISTER_VERSION = "2026-02-17-v5";
const BODY_LIMIT = 32 * 1024;

function strapiBaseUrl() {
  const raw = process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";

  let base = raw.replace(/\/+$/, "");
  const isLocal = base.includes("localhost") || base.includes("127.0.0.1") || base.includes("0.0.0.0");

  if (process.env.NODE_ENV === "production" && !isLocal) {
    base = base.replace(/^http:\/\//i, "https://");
  }
  return base;
}

const STRAPI_SERVICE_TOKEN =
  process.env.STRAPI_API_TOKEN ||
  process.env.STRAPI_TOKEN ||
  process.env.NEXT_PUBLIC_STRAPI_API_TOKEN ||
  process.env.NEXT_PUBLIC_STRAPI_TOKEN ||
  "";

function jsonNoStore(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      Vary: "Cookie",
      "X-TF-Register-Version": REGISTER_VERSION,
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

function normalizeEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

function isValidEmail(email: string) {
  if (!email || email.length > 254) return false;
  if (/\s/.test(email)) return false;

  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@")) return false;

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!local || !domain) return false;
  if (domain.startsWith(".") || domain.endsWith(".")) return false;
  if (!domain.includes(".")) return false;

  return true;
}

function isStrongEnough(pw: string) {
  return typeof pw === "string" && pw.length >= 8 && pw.length <= 200;
}

function clampString(v: any, max = 120) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max) : s;
}

function sanitizeEmailMaybe(v: any) {
  const e = normalizeEmail(v);
  if (!e) return "";
  return isValidEmail(e) ? e : "";
}

const GENERIC_RECOVERY_MSG =
  "Se esiste un account associato a questa email, riceverai un messaggio con le istruzioni per recuperare l’accesso.";

function isRetryableFetchError(e: any) {
  const code = e?.cause?.code || e?.code;
  return (
    e?.name === "AbortError" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "EAI_AGAIN" ||
    String(e?.message || "").toLowerCase().includes("fetch failed")
  );
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function fetchWithRetry(url: string, init: RequestInit, ms: number, tries = 2) {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      return await fetchWithTimeout(url, init, ms);
    } catch (e: any) {
      lastErr = e;
      if (!isRetryableFetchError(e) || i === tries - 1) break;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr;
}

async function strapiPost(path: string, body: any, timeoutMs: number, token?: string) {
  const base = strapiBaseUrl();
  const url = `${base}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetchWithRetry(url, { method: "POST", headers, body: JSON.stringify(body) }, timeoutMs, 2);

  const text = await res.text().catch(() => "");
  const data = safeJsonParse(text);
  return { res, data, text, url };
}

async function strapiGet(pathWithQs: string, timeoutMs: number, token?: string) {
  const base = strapiBaseUrl();
  const url = `${base}${pathWithQs}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetchWithRetry(url, { method: "GET", headers }, timeoutMs, 2);
  const text = await res.text().catch(() => "");
  const data = safeJsonParse(text);
  return { res, data, text, url };
}

async function strapiPut(path: string, body: any, timeoutMs: number, token?: string) {
  const base = strapiBaseUrl();
  const url = `${base}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetchWithRetry(url, { method: "PUT", headers, body: JSON.stringify(body) }, timeoutMs, 2);
  const text = await res.text().catch(() => "");
  const data = safeJsonParse(text);
  return { res, data, text, url };
}

function looksLikeAlreadyRegistered(status: number, strapiData: any, strapiText: string) {
  if (!(status === 400 || status === 409)) return false;

  const msg =
    String(strapiData?.error?.message ?? "") ||
    String(strapiData?.message ?? "") ||
    String(strapiText ?? "");

  const m = msg.toLowerCase();
  return (
    m.includes("already taken") ||
    m.includes("already exists") ||
    m.includes("duplicate") ||
    m.includes("unique") ||
    (m.includes("email") && (m.includes("already") || m.includes("unique"))) ||
    (m.includes("username") && (m.includes("already") || m.includes("unique")))
  );
}

function looksLikeUniqueViolation(status: number, strapiData: any, strapiText: string) {
  if (!(status === 400 || status === 409)) return false;
  const msg =
    String(strapiData?.error?.message ?? "") ||
    String(strapiData?.message ?? "") ||
    String(strapiText ?? "");
  const m = msg.toLowerCase();
  return m.includes("unique") || m.includes("duplicate") || m.includes("already");
}

async function readBodyWithLimit(req: Request, limitBytes = BODY_LIMIT) {
  const raw = await req.text().catch(() => "");
  if (raw && raw.length > limitBytes) return { raw: "", tooLarge: true };
  return { raw, tooLarge: false };
}

function setAuthCookie(resp: NextResponse, jwt: string) {
  resp.cookies.set("tf_token", jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

// mapping verso enum Strapi
function toStrapiCustomerType(type: "PERSON" | "BUSINESS") {
  return type === "BUSINESS" ? "BUSINESS" : "PRIVATE";
}

/**
 * ✅ Upsert CustomerProfile:
 * - prova create
 * - se fallisce per unique/duplicate, prova a trovare il profilo per userId e fare update
 */
async function ensureCustomerProfile(
  userId: number,
  firstName: string,
  lastName: string,
  type: "PERSON" | "BUSINESS",
  userJwt?: string
) {
  const TIMEOUT = 12_000;

  // patch pulito
  const patch = {
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    customerType: toStrapiCustomerType(type),
    user: userId,
  };

  // scegliamo il token migliore disponibile
  const tokenToUse = STRAPI_SERVICE_TOKEN || userJwt || "";
  if (!tokenToUse) return false;

  // 1) prova CREATE
  const create = await strapiPost("/api/customer-profiles", { data: patch }, TIMEOUT, tokenToUse);
  console.warn("[register] ensureCustomerProfile create", { ok: create.res.ok, status: create.res.status });

  if (create.res.ok) return true;

  // se non è un errore da “già esiste”, fermati
  if (!looksLikeUniqueViolation(create.res.status, create.data, create.text)) return false;

  // 2) trova profilo esistente e fai UPDATE
  const qs = new URLSearchParams();
  qs.set("pagination[pageSize]", "1");
  qs.set("filters[user][id][$eq]", String(userId));
  qs.set("publicationState", "preview"); // compat v5/v4
  const found = await strapiGet(`/api/customer-profiles?${qs.toString()}`, TIMEOUT, tokenToUse);

  const row = Array.isArray(found.data?.data) ? found.data.data[0] : null;
  const docId = row?.documentId ? String(row.documentId) : null;
  const id = row?.id ? String(row.id) : null;
  const key = docId || id;

  if (!key) return false;

  const upd = await strapiPut(`/api/customer-profiles/${encodeURIComponent(key)}`, { data: patch }, TIMEOUT, tokenToUse);
  console.warn("[register] ensureCustomerProfile update", { ok: upd.res.ok, status: upd.res.status });

  return upd.res.ok;
}

async function createCompanyBestEffort(
  userId: number,
  payload: { companyName: string; vatNumber: string; sdi: string; pec: string }
) {
  if (!STRAPI_SERVICE_TOKEN) return;

  const TIMEOUT = 10_000;
  const baseData = {
    companyName: payload.companyName || undefined,
    vatNumber: payload.vatNumber || undefined,
    sdi: payload.sdi || undefined,
    pec: payload.pec || undefined,
  };

  let r = await strapiPost(
    "/api/aziendes",
    { data: { ...baseData, users_permissions_users: [userId] } },
    TIMEOUT,
    STRAPI_SERVICE_TOKEN
  );
  if (r.res.ok) return;

  r = await strapiPost(
    "/api/aziendes",
    { data: { ...baseData, user: userId } },
    TIMEOUT,
    STRAPI_SERVICE_TOKEN
  );
  if (r.res.ok) return;

  await strapiPost(
    "/api/aziendes",
    { data: { ...baseData, users: [userId] } },
    TIMEOUT,
    STRAPI_SERVICE_TOKEN
  );
}

export async function GET() {
  return jsonNoStore(
    {
      ok: true,
      version: REGISTER_VERSION,
      hasServiceToken: Boolean(STRAPI_SERVICE_TOKEN),
      strapiUrl: strapiBaseUrl(),
    },
    200
  );
}

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return jsonNoStore({ ok: false, error: "UNSUPPORTED_CONTENT_TYPE" }, 415);
    }

    const { raw, tooLarge } = await readBodyWithLimit(req);
    if (tooLarge) return jsonNoStore({ ok: false, error: "PAYLOAD_TOO_LARGE" }, 413);

    const body = safeJsonParse(raw) ?? {};

    const type: "PERSON" | "BUSINESS" =
      String(body?.type ?? "PERSON").toUpperCase() === "BUSINESS" ? "BUSINESS" : "PERSON";

    const email = normalizeEmail(body?.email);
    const password = String(body?.password ?? "");

    const firstName = clampString(body?.firstName, 60);
    const lastName = clampString(body?.lastName, 60);

    const companyName = clampString(body?.companyName, 140);
    const vatNumber = clampString(body?.vat ?? body?.vatNumber, 40);
    const sdi = clampString(body?.sdi, 20);
    const pec = sanitizeEmailMaybe(body?.pec);

    if (!isValidEmail(email)) return jsonNoStore({ ok: false, error: "INVALID_INPUT" }, 400);
    if (!isStrongEnough(password)) return jsonNoStore({ ok: false, error: "WEAK_PASSWORD" }, 400);
    if (type === "BUSINESS") {
      if (!companyName || !vatNumber || !sdi || !pec) {
        return jsonNoStore({ ok: false, error: "MISSING_COMPANY_FIELDS" }, 400);
      }
      if (!isValidEmail(pec)) {
        return jsonNoStore({ ok: false, error: "INVALID_INPUT" }, 400);
      }
    }


    const REG_TIMEOUT = 15_000;
    const FORGOT_TIMEOUT = 6_000;

    const reg = await strapiPost("/api/auth/local/register", { email, password, username: email }, REG_TIMEOUT);

    if (reg.res.ok) {
      const jwt = reg.data?.jwt as string | undefined;
      const userId = Number(reg.data?.user?.id ?? 0);

      const response = jsonNoStore({ ok: true, loggedIn: Boolean(jwt), type }, 200);
      if (jwt) setAuthCookie(response, jwt);

      if (userId > 0) {
        try {
          const createdOrUpdated = await ensureCustomerProfile(userId, firstName, lastName, type, jwt);
          console.warn("[register] ensureCustomerProfile result", { userId, createdOrUpdated });
        } catch {
          // noop
        }

        if (type === "BUSINESS") {
          try {
            await createCompanyBestEffort(userId, { companyName, vatNumber, sdi, pec });
          } catch {
            // noop
          }
        }
      }

      return response;
    }

    if (looksLikeAlreadyRegistered(reg.res.status, reg.data, reg.text)) {
      try {
        await strapiPost("/api/auth/forgot-password", { email }, FORGOT_TIMEOUT);
      } catch {
        // noop
      }
      return jsonNoStore({ ok: false, error: "CHECK_EMAIL", message: GENERIC_RECOVERY_MSG }, 200);
    }

    const isDev = process.env.NODE_ENV === "development";
    return jsonNoStore(
      { ok: false, error: "REGISTER_FAILED", ...(isDev ? { debug: { status: reg.res.status } } : {}) },
      502
    );
  } catch (e: any) {
    if (isRetryableFetchError(e)) {
      return jsonNoStore(
        { ok: false, error: "UPSTREAM_TIMEOUT", message: "Servizio temporaneamente non disponibile. Riprova." },
        504
      );
    }
    return jsonNoStore({ ok: false, error: "UNHANDLED" }, 500);
  }
}
