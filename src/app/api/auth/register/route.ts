import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * HARDENING:
 * - Anti-enumeration: se email già presente => risposta generica 200
 * - Content-Type check + JSON parse robusto
 * - Body size limit (DoS basic)
 * - Timeout + retry per Strapi (Render può essere lento)
 * - Cookie HttpOnly su registrazione (auto-login)
 * - Crea CustomerProfile/Aziende (best-effort) senza rompere la registrazione
 * - Vary: Cookie + no-store
 */

function strapiBaseUrl() {
  const raw =
    process.env.STRAPI_URL ||
    process.env.NEXT_PUBLIC_STRAPI_URL ||
    "http://localhost:1337";

  let base = raw.replace(/\/+$/, "");
  const isLocal =
    base.includes("localhost") ||
    base.includes("127.0.0.1") ||
    base.includes("0.0.0.0");

  // In prod forza https se non è locale
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
      "Vary": "Cookie",
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
  // Base: minimo 8, max 200 (anti abuse)
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

/** Messaggio anti-enumeration */
const GENERIC_RECOVERY_MSG =
  "Se esiste un account associato a questa email, riceverai un messaggio con le istruzioni per recuperare l’accesso.";

/** Timeout+retry fetch */
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

  const res = await fetchWithRetry(
    url,
    { method: "POST", headers, body: JSON.stringify(body) },
    timeoutMs,
    2
  );

  const text = await res.text().catch(() => "");
  const data = safeJsonParse(text);
  return { res, data, text, url };
}

/**
 * Detect "already registered" in modo più conservativo:
 * - guardiamo status 400/409
 * - e messaggi classici su unique/duplicate
 */
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

/** body limit: 32KB */
async function readBodyWithLimit(req: Request, limitBytes = 32 * 1024) {
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
    maxAge: 60 * 60 * 24 * 7, // 7 giorni
  });
}

/**
 * Best-effort create entity con fallback sui nomi campo relazione
 */
async function createCustomerProfileBestEffort(userId: number, payload: { firstName: string; lastName: string; accountType: string }) {
  if (!STRAPI_SERVICE_TOKEN) return;

  const TIMEOUT = 10_000;
  const baseData = {
    firstName: payload.firstName || undefined,
    lastName: payload.lastName || undefined,
    accountType: payload.accountType || undefined,
  };

  // tentativo 1: field "user"
  const r = await strapiPost(
    "/api/customer-profiles",
    { data: { ...baseData, user: userId } },
    TIMEOUT,
    STRAPI_SERVICE_TOKEN
  );
  if (r.res.ok) return;

  // tentativo 2: field "users_permissions_user"
  await strapiPost(
    "/api/customer-profiles",
    { data: { ...baseData, users_permissions_user: userId } },
    TIMEOUT,
    STRAPI_SERVICE_TOKEN
  );
}

async function createCompanyBestEffort(userId: number, payload: { companyName: string; vatNumber: string; sdi: string; pec: string }) {
  if (!STRAPI_SERVICE_TOKEN) return;

  const TIMEOUT = 10_000;
  const baseData = {
    companyName: payload.companyName || undefined,
    vatNumber: payload.vatNumber || undefined,
    sdi: payload.sdi || undefined,
    pec: payload.pec || undefined,
  };

  // tentativo 1: relation array "users_permissions_users"
  let r = await strapiPost(
    "/api/aziendes",
    { data: { ...baseData, users_permissions_users: [userId] } },
    TIMEOUT,
    STRAPI_SERVICE_TOKEN
  );
  if (r.res.ok) return;

  // tentativo 2: (alcuni setup usano "user" o "users")
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

export async function POST(req: Request) {
  try {
    // Content-Type check (evita form-data / spam)
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return jsonNoStore({ ok: false, error: "UNSUPPORTED_CONTENT_TYPE" }, 415);
    }

    const { raw, tooLarge } = await readBodyWithLimit(req);
    if (tooLarge) return jsonNoStore({ ok: false, error: "PAYLOAD_TOO_LARGE" }, 413);

    const body = safeJsonParse(raw) ?? {};

    const type =
      String(body?.type ?? "PERSON").toUpperCase() === "BUSINESS" ? "BUSINESS" : "PERSON";

    const email = normalizeEmail(body?.email);
    const password = String(body?.password ?? "");

    // dati persona (vanno su CustomerProfile)
    const firstName = clampString(body?.firstName, 60);
    const lastName = clampString(body?.lastName, 60);

    // dati azienda (vanno su Aziende)
    const companyName = clampString(body?.companyName, 140);
    const vatNumber = clampString(body?.vat ?? body?.vatNumber, 40);
    const sdi = clampString(body?.sdi, 20);
    // PEC: la salviamo solo se valida, senza bloccare la registrazione
    const pec = sanitizeEmailMaybe(body?.pec);

    if (!isValidEmail(email)) return jsonNoStore({ ok: false, error: "INVALID_INPUT" }, 400);
    if (!isStrongEnough(password)) return jsonNoStore({ ok: false, error: "WEAK_PASSWORD" }, 400);
    if (type === "BUSINESS" && !companyName) return jsonNoStore({ ok: false, error: "MISSING_COMPANY" }, 400);

    const REG_TIMEOUT = 15_000;
    const FORGOT_TIMEOUT = 6_000;

    // 1) registra su Strapi
    // ✅ username rimosso: usiamo sempre email (Strapi richiede username)
    const reg = await strapiPost(
      "/api/auth/local/register",
      {
        email,
        password,
        username: email,
      },
      REG_TIMEOUT
    );

    if (reg.res.ok) {
      const jwt = reg.data?.jwt as string | undefined;
      const userId = Number(reg.data?.user?.id ?? 0);

      const response = jsonNoStore({ ok: true, loggedIn: Boolean(jwt), type }, 200);

      // ✅ auto-login (cookie HttpOnly)
      if (jwt) setAuthCookie(response, jwt);

      // 2) crea CustomerProfile/Aziende (best-effort)
      if (userId > 0) {
        try {
          await createCustomerProfileBestEffort(userId, { firstName, lastName, accountType: type });
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

      // debug soft in dev se manca token service (non rompe)
      if (process.env.NODE_ENV === "development" && !STRAPI_SERVICE_TOKEN) {
        response.headers.set("X-Debug-Info", "STRAPI_SERVICE_TOKEN missing: profiles not created");
      }

      return response;
    }

    // 2) già registrato => risposta generica + forgot-password best-effort
    if (looksLikeAlreadyRegistered(reg.res.status, reg.data, reg.text)) {
      try {
        await strapiPost("/api/auth/forgot-password", { email }, FORGOT_TIMEOUT);
      } catch {
        // provider email non configurato? non deve rompere
      }

      return jsonNoStore(
        { ok: false, error: "CHECK_EMAIL", message: GENERIC_RECOVERY_MSG },
        200
      );
    }

    // 3) altri errori (no leak dettagli in prod)
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
