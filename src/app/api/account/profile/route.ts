// src/app/api/account/profile/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BODY_LIMIT = 32 * 1024;

function strapiBaseUrl() {
  const raw = process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";
  let base = raw.replace(/\/+$/, "");
  const isLocal = base.includes("localhost") || base.includes("127.0.0.1") || base.includes("0.0.0.0");
  if (process.env.NODE_ENV === "production" && !isLocal) base = base.replace(/^http:\/\//i, "https://");
  return base;
}

const STRAPI_SERVICE_TOKEN =
  process.env.STRAPI_API_TOKEN ||
  process.env.STRAPI_TOKEN ||
  process.env.NEXT_PUBLIC_STRAPI_API_TOKEN ||
  process.env.NEXT_PUBLIC_STRAPI_TOKEN ||
  "";

function jsonNoStore(data: any, status = 200, extraHeaders?: Record<string, string>) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      Vary: "Cookie",
      ...(extraHeaders || {}),
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

function sanitize(input: unknown, maxLen = 160) {
  const raw = String(input ?? "");
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
}

function normalizeCustomerType(v: any): "PRIVATE" | "BUSINESS" {
  return String(v ?? "").toUpperCase().trim() === "BUSINESS" ? "BUSINESS" : "PRIVATE";
}

type Address = {
  address?: string;
  city?: string;
  postalCode?: string;
  province?: string;
  country?: string;
};

function normalizeAddress(a: any): Required<Address> {
  return {
    address: sanitize(a?.address, 160),
    city: sanitize(a?.city, 80),
    postalCode: sanitize(a?.postalCode, 12),
    province: sanitize(a?.province, 40),
    country: sanitize((a?.country || "IT").toUpperCase(), 2) || "IT",
  };
}

function addressHasAny(a: Required<Address>) {
  const core = [a.address, a.city, a.postalCode, a.province].some((x) => String(x || "").trim().length > 0);
  const country = String(a.country || "").trim().toUpperCase();
  const countryMeaningful = country && country !== "IT";
  return core || countryMeaningful;
}

function validateAddressIfAny(a: Required<Address>) {
  if (!addressHasAny(a)) return { ok: true as const, msg: "" };
  if (a.address.trim().length < 2) return { ok: false as const, msg: "Indirizzo non valido." };
  if (a.city.trim().length < 2) return { ok: false as const, msg: "Città non valida." };
  if (a.postalCode.trim().length < 3) return { ok: false as const, msg: "CAP non valido." };
  if (a.country.trim().length !== 2) return { ok: false as const, msg: "Paese non valido (usa 2 lettere, es. IT)." };
  return { ok: true as const, msg: "" };
}

async function readBodyWithLimit(req: Request, limitBytes = BODY_LIMIT) {
  const raw = await req.text().catch(() => "");
  if (raw && raw.length > limitBytes) return { raw: "", tooLarge: true };
  return { raw, tooLarge: false };
}

function getCookieValue(cookieHeader: string, name: string) {
  const parts = cookieHeader.split(";").map((p) => p.trim());
  const hit = parts.find((p) => p.startsWith(`${name}=`));
  if (!hit) return null;
  return decodeURIComponent(hit.slice(name.length + 1));
}

function getJwtFromReq(req: Request) {
  const cookieHeader = req.headers.get("cookie") || "";
  return getCookieValue(cookieHeader, "tf_token") || getCookieValue(cookieHeader, "jwtToken") || "";
}

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

async function fetchJson(url: string, init: RequestInit, timeoutMs = 12_000) {
  const res = await fetchWithRetry(url, init, timeoutMs, 2);
  const text = await res.text().catch(() => "");
  return { res, json: safeJsonParse(text), text };
}

async function getUserFromJwt(base: string, jwt: string) {
  const me = await fetchJson(
    `${base}/api/users/me`,
    {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${jwt}` },
    },
    12_000
  );
  if (!me.res.ok || !me.json?.id) return null;
  return {
    id: Number(me.json.id),
    email: String(me.json.email ?? ""),
    username: String(me.json.username ?? ""),
  };
}

/** v4: row.attributes, v5: flat */
function extractAttrs(row: any) {
  if (!row || typeof row !== "object") return {};
  if (row.attributes && typeof row.attributes === "object") return row.attributes;
  const out: any = { ...row };
  delete out.id;
  delete out.documentId;
  return out;
}

function pickKey(row: any): { id: string | null; documentId: string | null } {
  const id = typeof row?.id === "number" ? String(row.id) : typeof row?.id === "string" ? row.id : null;
  const doc =
    typeof row?.documentId === "string"
      ? row.documentId
      : typeof row?.attributes?.documentId === "string"
      ? row.attributes.documentId
      : null;
  return { id, documentId: doc };
}

async function findCustomerProfile(base: string, userId: number) {
  const headers = { Accept: "application/json", Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}` };

  async function tryQuery(qs: URLSearchParams) {
    const r = await fetchJson(`${base}/api/customer-profiles?${qs.toString()}`, { method: "GET", headers }, 12_000);
    const row = Array.isArray(r.json?.data) ? r.json.data[0] : null;
    if (!row) return null;
    const { id, documentId } = pickKey(row);
    if (!id && !documentId) return null;
    return { row, id, documentId, attrs: extractAttrs(row) };
  }

  const qs1 = new URLSearchParams();
  qs1.set("populate", "*");
  qs1.set("pagination[pageSize]", "1");
  qs1.set("filters[user][id][$eq]", String(userId));

  let found = await tryQuery(qs1);
  if (found) return found;

  const qs1b = new URLSearchParams(qs1);
  qs1b.set("publicationState", "preview");
  found = await tryQuery(qs1b);
  if (found) return found;

  // fallback legacy relations
  const qs2 = new URLSearchParams();
  qs2.set("populate", "*");
  qs2.set("pagination[pageSize]", "1");
  qs2.set("filters[users_permissions_user][id][$eq]", String(userId));

  found = await tryQuery(qs2);
  if (found) return found;

  const qs2b = new URLSearchParams(qs2);
  qs2b.set("publicationState", "preview");
  found = await tryQuery(qs2b);
  if (found) return found;

  return null;
}

async function createCustomerProfile(base: string, userId: number, data: any) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}`,
  };

  const payload = { data: { ...data, user: userId } };

  // compat Draft&Publish (se esiste)
  if (!("publishedAt" in (data || {}))) {
    (payload.data as any).publishedAt = new Date().toISOString();
  }

  const c = await fetchJson(`${base}/api/customer-profiles`, { method: "POST", headers, body: JSON.stringify(payload) }, 12_000);
  const row = c.json?.data ?? null;
  if (!c.res.ok || !row) return null;

  const { id, documentId } = pickKey(row);
  if (!id && !documentId) return null;

  return { row, id, documentId, attrs: extractAttrs(row) };
}

async function updateCustomerProfile(base: string, key: string, patch: any) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}`,
  };

  const urls = [
    `${base}/api/customer-profiles/${encodeURIComponent(key)}`,
    `${base}/api/customer-profiles/${encodeURIComponent(key)}?publicationState=preview`,
  ];

  let last: any = null;
  for (const url of urls) {
    const r = await fetchJson(url, { method: "PUT", headers, body: JSON.stringify({ data: patch }) }, 12_000);
    last = r;
    if (r.res.ok) return r;
  }
  return last;
}

export async function GET(req: Request) {
  const jwt = getJwtFromReq(req);
  if (!jwt) return jsonNoStore({ ok: false, error: "UNAUTHORIZED" }, 401);

  if (!STRAPI_SERVICE_TOKEN) return jsonNoStore({ ok: false, error: "SERVER_MISCONFIG" }, 500);

  const base = strapiBaseUrl();
  const me = await getUserFromJwt(base, jwt);
  if (!me) return jsonNoStore({ ok: false, error: "UNAUTHORIZED" }, 401);

  const profile = await findCustomerProfile(base, me.id);

  if (!profile) {
    return jsonNoStore(
      {
        ok: true,
        exists: false,
        email: me.email,
        customerType: "PRIVATE",
        firstName: "",
        lastName: "",
        shippingAddress: null,
        billingAddress: null,
      },
      200
    );
  }

  const attrs = profile.attrs || {};
  return jsonNoStore(
    {
      ok: true,
      exists: true,
      email: me.email,
      customerType: normalizeCustomerType(attrs.customerType),
      firstName: String(attrs.firstName ?? ""),
      lastName: String(attrs.lastName ?? ""),
      shippingAddress: attrs.shippingAddress ?? null,
      billingAddress: attrs.billingAddress ?? null,
    },
    200
  );
}

export async function PUT(req: Request) {
  const jwt = getJwtFromReq(req);
  if (!jwt) return jsonNoStore({ ok: false, error: "UNAUTHORIZED" }, 401);

  if (!STRAPI_SERVICE_TOKEN) return jsonNoStore({ ok: false, error: "SERVER_MISCONFIG" }, 500);

  const base = strapiBaseUrl();
  const me = await getUserFromJwt(base, jwt);
  if (!me) return jsonNoStore({ ok: false, error: "UNAUTHORIZED" }, 401);

  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return jsonNoStore({ ok: false, error: "UNSUPPORTED_CONTENT_TYPE" }, 415);

  const { raw, tooLarge } = await readBodyWithLimit(req);
  if (tooLarge) return jsonNoStore({ ok: false, error: "PAYLOAD_TOO_LARGE" }, 413);

  const body = safeJsonParse(raw) ?? {};

  const firstName = sanitize(body?.firstName, 60);
  const lastName = sanitize(body?.lastName, 60);

  if (firstName.trim().length < 2 || lastName.trim().length < 2) {
    return jsonNoStore({ ok: false, error: "INVALID_NAME" }, 400);
  }

  const shipping = body?.shippingAddress ? normalizeAddress(body.shippingAddress) : normalizeAddress(null);
  const billing = body?.billingAddress ? normalizeAddress(body.billingAddress) : normalizeAddress(null);

  const shipVal = validateAddressIfAny(shipping);
  if (!shipVal.ok) return jsonNoStore({ ok: false, error: "INVALID_SHIPPING", message: shipVal.msg }, 400);

  const billVal = validateAddressIfAny(billing);
  if (!billVal.ok) return jsonNoStore({ ok: false, error: "INVALID_BILLING", message: billVal.msg }, 400);

  const profile = await findCustomerProfile(base, me.id);

  const patch: any = {
    firstName,
    lastName,
    customerType: profile?.attrs?.customerType ? normalizeCustomerType(profile.attrs.customerType) : "PRIVATE",
    shippingAddress: addressHasAny(shipping) ? shipping : null,
    billingAddress: addressHasAny(billing) ? billing : null,
  };

  // CREATE
  if (!profile) {
    const created = await createCustomerProfile(base, me.id, patch);
    if (!created) return jsonNoStore({ ok: false, error: "CREATE_FAILED" }, 502);

    const attrs = created.attrs || {};
    return jsonNoStore(
      {
        ok: true,
        exists: true,
        email: me.email,
        customerType: normalizeCustomerType(attrs.customerType ?? patch.customerType),
        firstName: String(attrs.firstName ?? firstName),
        lastName: String(attrs.lastName ?? lastName),
        shippingAddress: attrs.shippingAddress ?? patch.shippingAddress ?? null,
        billingAddress: attrs.billingAddress ?? patch.billingAddress ?? null,
      },
      200
    );
  }

  // UPDATE: prima id, poi documentId
  const keysToTry = [profile.id, profile.documentId].filter(Boolean) as string[];

  let lastFail: any = null;
  for (const key of keysToTry) {
    const upd = await updateCustomerProfile(base, key, patch);
    if (upd?.res?.ok) {
      const row = upd.json?.data ?? null;
      const attrs = extractAttrs(row);
      return jsonNoStore(
        {
          ok: true,
          exists: true,
          email: me.email,
          customerType: normalizeCustomerType(attrs.customerType ?? patch.customerType),
          firstName: String(attrs.firstName ?? firstName),
          lastName: String(attrs.lastName ?? lastName),
          shippingAddress: attrs.shippingAddress ?? patch.shippingAddress ?? null,
          billingAddress: attrs.billingAddress ?? patch.billingAddress ?? null,
        },
        200
      );
    }
    lastFail = upd;
  }

  const isDev = process.env.NODE_ENV !== "production";
  return jsonNoStore(
    {
      ok: false,
      error: "UPDATE_FAILED",
      ...(isDev
        ? {
            debug: {
              triedKeys: keysToTry,
              status: lastFail?.res?.status ?? null,
              text: String(lastFail?.text ?? "").slice(0, 1500),
            },
          }
        : {}),
    },
    502
  );
}