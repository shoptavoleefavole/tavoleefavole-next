// src/app/api/account/profile/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BODY_LIMIT = 32 * 1024;
const isDev = process.env.NODE_ENV === "development";

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
  if (process.env.NODE_ENV === "production" && !isLocal)
    base = base.replace(/^http:\/\//i, "https://");
  return base;
}

const STRAPI_SERVICE_TOKEN =
  process.env.STRAPI_API_TOKEN || process.env.STRAPI_TOKEN || "";

function jsonNoStore(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store", Vary: "Cookie" },
  });
}

function safeJsonParse(text: string) {
  try { return text ? JSON.parse(text) : null; } catch { return null; }
}

function sanitize(input: unknown, maxLen = 160) {
  const raw = String(input ?? "");
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
}

function sanitizeEmail(v: unknown): string {
  const e = String(v ?? "").trim().toLowerCase();
  if (!e || e.length > 254 || /\s/.test(e)) return "";
  const at = e.indexOf("@");
  if (at <= 0 || at !== e.lastIndexOf("@")) return "";
  const domain = e.slice(at + 1);
  if (!domain || !domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) return "";
  return e;
}

function normalizeCustomerType(v: any): "PRIVATE" | "BUSINESS" {
  return String(v ?? "").toUpperCase().trim() === "BUSINESS" ? "BUSINESS" : "PRIVATE";
}

// ✅ Converte "-" placeholder (usato in registrazione) in stringa vuota
function cleanPlaceholder(v: unknown): string {
  const s = String(v ?? "").trim();
  return s === "-" ? "" : s;
}

type Address = {
  address: string;
  city: string;
  postalCode: string;
  province: string;
  country: string;
};

function normalizeAddress(a: any): Address {
  return {
    address: sanitize(a?.address, 160),
    city: sanitize(a?.city, 80),
    postalCode: sanitize(a?.postalCode, 12),
    province: sanitize(a?.province, 40),
    country: sanitize((a?.country || "IT").toUpperCase(), 2) || "IT",
  };
}

function addressHasAny(a: Address) {
  const core = [a.address, a.city, a.postalCode, a.province].some(
    (x) => String(x || "").trim().length > 0
  );
  return core || (String(a.country || "").trim().toUpperCase() !== "IT");
}

function validateAddressIfAny(a: Address) {
  if (!addressHasAny(a)) return { ok: true as const, msg: "" };
  if (a.address.trim().length < 2) return { ok: false as const, msg: "Indirizzo non valido." };
  if (a.city.trim().length < 2) return { ok: false as const, msg: "Città non valida." };
  if (a.postalCode.trim().length < 3) return { ok: false as const, msg: "CAP non valido." };
  if (a.country.trim().length !== 2) return { ok: false as const, msg: "Paese non valido." };
  return { ok: true as const, msg: "" };
}

async function readBodyWithLimit(req: Request, limitBytes = BODY_LIMIT) {
  const raw = await req.text().catch(() => "");
  if (raw && raw.length > limitBytes) return { raw: "", tooLarge: true };
  return { raw, tooLarge: false };
}

function getCookieValue(cookieHeader: string, name: string) {
  const hit = cookieHeader.split(";").map((p) => p.trim()).find((p) => p.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

function getJwtFromReq(req: Request) {
  const h = req.headers.get("cookie") || "";
  return getCookieValue(h, "tf_token") || getCookieValue(h, "jwtToken") || "";
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
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function fetchWithRetry(url: string, init: RequestInit, ms: number, tries = 2) {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try { return await fetchWithTimeout(url, init, ms); }
    catch (e: any) {
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
    { method: "GET", headers: { Accept: "application/json", Authorization: `Bearer ${jwt}` } }
  );
  if (!me.res.ok || !me.json?.id) return null;
  return { id: Number(me.json.id), email: String(me.json.email ?? "") };
}

function extractAttrs(row: any) {
  if (!row || typeof row !== "object") return {};
  if (row.attributes && typeof row.attributes === "object") return row.attributes;
  const out: any = { ...row };
  delete out.id;
  delete out.documentId;
  return out;
}

function pickKey(row: any): { id: string | null; documentId: string | null } {
  const id =
    typeof row?.id === "number" ? String(row.id) :
    typeof row?.id === "string" ? row.id : null;
  const doc =
    typeof row?.documentId === "string" ? row.documentId :
    typeof row?.attributes?.documentId === "string" ? row.attributes.documentId : null;
  return { id, documentId: doc };
}

const serviceHeaders = () => ({
  Accept: "application/json",
  Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}`,
});

async function findCustomerProfile(base: string, userId: number) {
  function makeQs(filterKey: string, withPreview: boolean): URLSearchParams {
    const qs = new URLSearchParams();
    qs.set("populate", "*");
    qs.set("pagination[pageSize]", "1");
    qs.set(filterKey, String(userId));
    if (withPreview) qs.set("publicationState", "preview");
    return qs;
  }

  async function tryQuery(qs: URLSearchParams) {
    const r = await fetchJson(
      `${base}/api/customer-profiles?${qs.toString()}`,
      { method: "GET", headers: serviceHeaders() }
    );
    const row = Array.isArray(r.json?.data) ? r.json.data[0] : null;
    if (!row) return null;
    const { id, documentId } = pickKey(row);
    if (!id && !documentId) return null;
    return { row, id, documentId, attrs: extractAttrs(row) };
  }

  for (const preview of [false, true]) {
    const found = await tryQuery(makeQs("filters[user][id][$eq]", preview));
    if (found) return found;
  }
  for (const preview of [false, true]) {
    const found = await tryQuery(makeQs("filters[users_permissions_user][id][$eq]", preview));
    if (found) return found;
  }
  return null;
}

// ✅ Trova Azienda collegata all'utente (via users_permissions_users)
async function findAziendaByUserId(base: string, userId: number) {
  const qs = new URLSearchParams({
    "pagination[pageSize]": "1",
    "filters[users_permissions_users][id][$eq]": String(userId),
  });
  const r = await fetchJson(
    `${base}/api/aziendes?${qs.toString()}`,
    { method: "GET", headers: serviceHeaders() }
  );
  const row = Array.isArray(r.json?.data) ? r.json.data[0] : null;
  if (!row) return null;
  const { id, documentId } = pickKey(row);
  if (!id && !documentId) return null;
  return { id, documentId, attrs: extractAttrs(row) };
}

// ✅ Estrae attrs azienda dalla relazione popolata nel CustomerProfile
function extractAziendaFromProfileAttrs(profileAttrs: any): any | null {
  const azRel = profileAttrs?.azienda;
  if (!azRel) return null;
  // Strapi v5: oggetto diretto con id
  if (typeof azRel === "object" && azRel.id) return extractAttrs(azRel);
  // Strapi v4: { data: { id, attributes } }
  if (azRel?.data?.id) return extractAttrs(azRel.data);
  return null;
}

async function createCustomerProfile(base: string, userId: number, data: any) {
  const payload = { data: { ...data, user: userId, publishedAt: new Date().toISOString() } };
  const r = await fetchJson(
    `${base}/api/customer-profiles`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...serviceHeaders() },
      body: JSON.stringify(payload),
    }
  );
  const row = r.json?.data ?? null;
  if (!r.res.ok || !row) return null;
  const { id, documentId } = pickKey(row);
  if (!id && !documentId) return null;
  return { id, documentId, attrs: extractAttrs(row) };
}

async function updateCustomerProfile(base: string, key: string, patch: any) {
  const urls = [
    `${base}/api/customer-profiles/${encodeURIComponent(key)}`,
    `${base}/api/customer-profiles/${encodeURIComponent(key)}?publicationState=preview`,
  ];
  let last: any = null;
  for (const url of urls) {
    const r = await fetchJson(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...serviceHeaders() },
      body: JSON.stringify({ data: patch }),
    });
    last = r;
    if (r.res.ok) return r;
  }
  return last;
}

// ✅ Aggiorna i dati dell'Azienda
async function updateAzienda(base: string, key: string, patch: any) {
  return fetchJson(
    `${base}/api/aziendes/${encodeURIComponent(key)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...serviceHeaders() },
      body: JSON.stringify({ data: patch }),
    }
  );
}

// ✅ Costruisce la risposta unificata leggendo sia CustomerProfile che Azienda
function buildProfileResponse(
  profileAttrs: any,
  aziendaAttrs: any | null,
  email: string,
  fallback: any = {}
) {
  const ct = normalizeCustomerType(
    profileAttrs?.customerType ?? (aziendaAttrs ? "BUSINESS" : fallback.customerType)
  );
  return {
    ok: true,
    exists: true,
    email,
    customerType: ct,
    // ✅ Rimuovi placeholder "-" dai campi nome
    firstName: cleanPlaceholder(profileAttrs?.firstName ?? fallback.firstName ?? ""),
    lastName: cleanPlaceholder(profileAttrs?.lastName ?? fallback.lastName ?? ""),
    // ✅ Campi aziendali da Aziende (non da CustomerProfile)
    companyName: String(aziendaAttrs?.companyName ?? fallback.companyName ?? ""),
    vatNumber: String(aziendaAttrs?.vatNumber ?? fallback.vatNumber ?? ""),
    pec: String(aziendaAttrs?.pec ?? fallback.pec ?? ""),
    sdi: String(aziendaAttrs?.sdi ?? fallback.sdi ?? ""),
    shippingAddress: profileAttrs?.shippingAddress ?? fallback.shippingAddress ?? null,
    billingAddress: profileAttrs?.billingAddress ?? fallback.billingAddress ?? null,
  };
}

export async function GET(req: Request) {
  const jwt = getJwtFromReq(req);
  if (!jwt) return jsonNoStore({ ok: false, error: "UNAUTHORIZED" }, 401);
  if (!STRAPI_SERVICE_TOKEN) return jsonNoStore({ ok: false, error: "SERVER_MISCONFIG" }, 500);

  const base = strapiBaseUrl();
  const me = await getUserFromJwt(base, jwt);
  if (!me) return jsonNoStore({ ok: false, error: "UNAUTHORIZED" }, 401);

  // 1. Cerca il CustomerProfile
  const profile = await findCustomerProfile(base, me.id);

  // 2. Cerca l'Azienda (dalla relazione popolata o direttamente)
  let aziendaAttrs: any = null;
  if (profile) {
    aziendaAttrs = extractAziendaFromProfileAttrs(profile.attrs);
  }
  if (!aziendaAttrs) {
    const az = await findAziendaByUserId(base, me.id);
    aziendaAttrs = az?.attrs ?? null;
  }

  // 3. Se non esiste il CustomerProfile, ritorna shell con dati Azienda se disponibili
  if (!profile) {
    return jsonNoStore({
      ok: true,
      exists: false,
      email: me.email,
      customerType: aziendaAttrs ? "BUSINESS" : "PRIVATE",
      firstName: "",
      lastName: "",
      companyName: String(aziendaAttrs?.companyName ?? ""),
      vatNumber: String(aziendaAttrs?.vatNumber ?? ""),
      pec: String(aziendaAttrs?.pec ?? ""),
      sdi: String(aziendaAttrs?.sdi ?? ""),
      shippingAddress: null,
      billingAddress: null,
    }, 200);
  }

  return jsonNoStore(buildProfileResponse(profile.attrs, aziendaAttrs, me.email), 200);
}

export async function PUT(req: Request) {
  const jwt = getJwtFromReq(req);
  if (!jwt) return jsonNoStore({ ok: false, error: "UNAUTHORIZED" }, 401);
  if (!STRAPI_SERVICE_TOKEN) return jsonNoStore({ ok: false, error: "SERVER_MISCONFIG" }, 500);

  const base = strapiBaseUrl();
  const me = await getUserFromJwt(base, jwt);
  if (!me) return jsonNoStore({ ok: false, error: "UNAUTHORIZED" }, 401);

  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json"))
    return jsonNoStore({ ok: false, error: "UNSUPPORTED_CONTENT_TYPE" }, 415);

  const { raw, tooLarge } = await readBodyWithLimit(req);
  if (tooLarge) return jsonNoStore({ ok: false, error: "PAYLOAD_TOO_LARGE" }, 413);

  const body = safeJsonParse(raw) ?? {};

  const firstName = sanitize(body?.firstName, 60);
  const lastName = sanitize(body?.lastName, 60);

  if (firstName.trim().length < 2 || lastName.trim().length < 2)
    return jsonNoStore({ ok: false, error: "INVALID_NAME" }, 400);

  const shipping = body?.shippingAddress
    ? normalizeAddress(body.shippingAddress)
    : normalizeAddress(null);
  const billing = body?.billingAddress
    ? normalizeAddress(body.billingAddress)
    : normalizeAddress(null);

  const shipVal = validateAddressIfAny(shipping);
  if (!shipVal.ok)
    return jsonNoStore({ ok: false, error: "INVALID_SHIPPING", message: shipVal.msg }, 400);

  const billVal = validateAddressIfAny(billing);
  if (!billVal.ok)
    return jsonNoStore({ ok: false, error: "INVALID_BILLING", message: billVal.msg }, 400);

  // Cerca CustomerProfile e Azienda in parallelo
  const [profile, azienda] = await Promise.all([
    findCustomerProfile(base, me.id),
    findAziendaByUserId(base, me.id),
  ]);

  const existingType = azienda
    ? "BUSINESS"
    : normalizeCustomerType(profile?.attrs?.customerType);

  // ✅ Valida e aggiorna i campi Azienda se BUSINESS
  if (existingType === "BUSINESS" && azienda) {
    const companyName = sanitize(body?.companyName, 140);
    const vatNumber = sanitize(body?.vatNumber, 40);
    const pecRaw = sanitizeEmail(body?.pec);
    const sdi = sanitize(body?.sdi, 20).toUpperCase();

    if (!companyName || companyName.length < 2)
      return jsonNoStore({ ok: false, error: "INVALID_COMPANY_NAME" }, 400);
    if (!vatNumber || vatNumber.length < 5)
      return jsonNoStore({ ok: false, error: "INVALID_VAT_NUMBER" }, 400);
    if (!pecRaw)
      return jsonNoStore({ ok: false, error: "INVALID_PEC" }, 400);
    if (!sdi || sdi.length < 3)
      return jsonNoStore({ ok: false, error: "INVALID_SDI" }, 400);

    const azKey = azienda.id || azienda.documentId;
    if (azKey) {
      await updateAzienda(base, azKey, { companyName, vatNumber, pec: pecRaw, sdi });
    }

    // Ricarica azienda dopo update
    const updatedAzienda = await findAziendaByUserId(base, me.id);
    const newAziendaAttrs = updatedAzienda?.attrs ?? null;
    const aziendeId = azienda.id ? Number(azienda.id) : null;

    // ✅ Patch CustomerProfile (linka azienda se mancante)
    const patch: any = {
      firstName,
      lastName,
      customerType: "BUSINESS",
      shippingAddress: addressHasAny(shipping) ? shipping : null,
      billingAddress: addressHasAny(billing) ? billing : null,
      ...(aziendeId ? { azienda: aziendeId } : {}),
    };

    if (!profile) {
      const created = await createCustomerProfile(base, me.id, patch);
      if (!created) return jsonNoStore({ ok: false, error: "CREATE_FAILED" }, 502);
      return jsonNoStore(buildProfileResponse(created.attrs, newAziendaAttrs, me.email, patch), 200);
    }

    const keysToTry = [profile.id, profile.documentId].filter(Boolean) as string[];
    for (const key of keysToTry) {
      const upd = await updateCustomerProfile(base, key, patch);
      if (upd?.res?.ok) {
        const attrs = upd.json?.data ? extractAttrs(upd.json.data) : patch;
        return jsonNoStore(buildProfileResponse(attrs, newAziendaAttrs, me.email, patch), 200);
      }
    }

    return jsonNoStore({ ok: false, error: "UPDATE_FAILED" }, 502);
  }

  // ✅ Utente PRIVATE
  const patch: any = {
    firstName,
    lastName,
    customerType: "PRIVATE",
    shippingAddress: addressHasAny(shipping) ? shipping : null,
    billingAddress: addressHasAny(billing) ? billing : null,
  };

  if (!profile) {
    const created = await createCustomerProfile(base, me.id, patch);
    if (!created) return jsonNoStore({ ok: false, error: "CREATE_FAILED" }, 502);
    return jsonNoStore(buildProfileResponse(created.attrs, null, me.email, patch), 200);
  }

  const keysToTry = [profile.id, profile.documentId].filter(Boolean) as string[];
  let lastFail: any = null;

  for (const key of keysToTry) {
    const upd = await updateCustomerProfile(base, key, patch);
    if (upd?.res?.ok) {
      const attrs = upd.json?.data ? extractAttrs(upd.json.data) : patch;
      return jsonNoStore(buildProfileResponse(attrs, null, me.email, patch), 200);
    }
    lastFail = upd;
  }

  return jsonNoStore(
    {
      ok: false,
      error: "UPDATE_FAILED",
      ...(isDev ? { debug: { triedKeys: keysToTry, status: lastFail?.res?.status, text: String(lastFail?.text ?? "").slice(0, 500) } } : {}),
    },
    502
  );
}
