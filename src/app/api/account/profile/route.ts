import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BODY_LIMIT = 32 * 1024;

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
  address: string;
  city: string;
  postalCode: string;
  province: string;
  country: string; // ISO2 (IT)
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

/**
 * IMPORTANT:
 * Non consideriamo "country" per stabilire se l’utente ha compilato l’indirizzo,
 * perché di default è "IT" e farebbe scattare la validazione anche quando tutto il resto è vuoto.
 */
function addressHasAnyMeaningful(a: Address) {
  return [a.address, a.city, a.postalCode, a.province].some((x) => String(x || "").trim().length > 0);
}

function validateAddressIfAny(a: Address) {
  if (!addressHasAnyMeaningful(a)) return { ok: true as const, msg: "" };

  if (a.address.trim().length < 2) return { ok: false as const, msg: "Indirizzo non valido." };
  if (a.city.trim().length < 2) return { ok: false as const, msg: "Città non valida." };
  if (a.postalCode.trim().length < 3) return { ok: false as const, msg: "CAP non valido." };
  if (a.country.trim().length !== 2) return { ok: false as const, msg: "Paese non valido (usa 2 lettere, es. IT)." };

  return { ok: true as const, msg: "" };
}

/** Body limit */
async function readBodyWithLimit(req: Request, limitBytes = BODY_LIMIT) {
  const raw = await req.text().catch(() => "");
  if (raw && raw.length > limitBytes) return { raw: "", tooLarge: true };
  return { raw, tooLarge: false };
}

async function fetchJson(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const text = await res.text().catch(() => "");
  return { res, json: safeJsonParse(text), text };
}

async function getUserFromJwt(base: string, jwt: string) {
  const me = await fetchJson(`${base}/api/users/me`, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${jwt}` },
  });
  if (!me.res.ok || !me.json?.id) return null;
  return {
    id: Number(me.json.id),
    email: String(me.json.email ?? ""),
    username: String(me.json.username ?? ""),
  };
}

/**
 * Legge il CustomerProfile anche se è in draft (publicationState=preview).
 */
async function findCustomerProfile(base: string, userId: number) {
  const headers = { Accept: "application/json", Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}` };

  const qs = new URLSearchParams();
  qs.set("publicationState", "preview");
  qs.set("populate", "*");
  qs.set("pagination[pageSize]", "1");
  qs.set("filters[user][id][$eq]", String(userId));

  const p1 = await fetchJson(`${base}/api/customer-profiles?${qs.toString()}`, { method: "GET", headers });
  const row1 = Array.isArray(p1.json?.data) ? p1.json.data[0] : null;
  if (row1?.id) return { id: Number(row1.id), attrs: row1.attributes ?? {} };

  // fallback legacy
  const qs2 = new URLSearchParams();
  qs2.set("publicationState", "preview");
  qs2.set("populate", "*");
  qs2.set("pagination[pageSize]", "1");
  qs2.set("filters[users_permissions_user][id][$eq]", String(userId));

  const p2 = await fetchJson(`${base}/api/customer-profiles?${qs2.toString()}`, { method: "GET", headers });
  const row2 = Array.isArray(p2.json?.data) ? p2.json.data[0] : null;
  if (row2?.id) return { id: Number(row2.id), attrs: row2.attributes ?? {} };

  return null;
}

/**
 * Crea un CustomerProfile (auto-publish se D&P attivo) con relazione user.
 */
async function createCustomerProfile(base: string, userId: number, data: any) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}`,
  };

  const payload = {
    data: {
      ...data,
      user: userId,
      // se D&P è attivo, pubblica subito; se non lo è, Strapi ignora publishedAt
      publishedAt: new Date().toISOString(),
    },
  };

  const c = await fetchJson(`${base}/api/customer-profiles?publicationState=preview`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (c.res.ok && c.json?.data?.id) {
    return { id: Number(c.json.data.id), attrs: c.json.data.attributes ?? {} };
  }
  return null;
}

async function getJwtOr401() {
  const cookieStore = await cookies();
  const jwt = cookieStore.get("tf_token")?.value || "";
  if (!jwt) return { jwt: "", err: jsonNoStore({ ok: false, error: "UNAUTHORIZED" }, 401) };
  return { jwt, err: null as any };
}

export async function GET() {
  const { jwt, err } = await getJwtOr401();
  if (err) return err;

  if (!STRAPI_SERVICE_TOKEN) {
    return jsonNoStore({ ok: false, error: "SERVER_MISCONFIG" }, 500);
  }

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

  return jsonNoStore(
    {
      ok: true,
      exists: true,
      email: me.email,
      customerType: normalizeCustomerType(profile.attrs?.customerType),
      firstName: String(profile.attrs?.firstName ?? ""),
      lastName: String(profile.attrs?.lastName ?? ""),
      shippingAddress: profile.attrs?.shippingAddress ?? null,
      billingAddress: profile.attrs?.billingAddress ?? null,
    },
    200
  );
}

export async function PUT(req: Request) {
  const { jwt, err } = await getJwtOr401();
  if (err) return err;

  if (!STRAPI_SERVICE_TOKEN) {
    return jsonNoStore({ ok: false, error: "SERVER_MISCONFIG" }, 500);
  }

  const base = strapiBaseUrl();
  const me = await getUserFromJwt(base, jwt);
  if (!me) return jsonNoStore({ ok: false, error: "UNAUTHORIZED" }, 401);

  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return jsonNoStore({ ok: false, error: "UNSUPPORTED_CONTENT_TYPE" }, 415);
  }

  const { raw, tooLarge } = await readBodyWithLimit(req);
  if (tooLarge) return jsonNoStore({ ok: false, error: "PAYLOAD_TOO_LARGE" }, 413);

  const body = safeJsonParse(raw) ?? {};

  const firstName = sanitize(body?.firstName, 60);
  const lastName = sanitize(body?.lastName, 60);

  if (firstName.trim().length < 2 || lastName.trim().length < 2) {
    return jsonNoStore({ ok: false, error: "INVALID_NAME" }, 400);
  }

  const shippingAddress = normalizeAddress(body?.shippingAddress);
  const billingAddress = normalizeAddress(body?.billingAddress);

  const shipVal = validateAddressIfAny(shippingAddress);
  if (!shipVal.ok) return jsonNoStore({ ok: false, error: "INVALID_SHIPPING", message: shipVal.msg }, 400);

  const billVal = validateAddressIfAny(billingAddress);
  if (!billVal.ok) return jsonNoStore({ ok: false, error: "INVALID_BILLING", message: billVal.msg }, 400);

  let profile = await findCustomerProfile(base, me.id);

  // patch dati
  const patch: any = {
    firstName,
    lastName,
    customerType: profile?.attrs?.customerType
      ? normalizeCustomerType(profile.attrs.customerType)
      : "PRIVATE",
  };

  if (addressHasAnyMeaningful(shippingAddress)) patch.shippingAddress = shippingAddress;
  if (addressHasAnyMeaningful(billingAddress)) patch.billingAddress = billingAddress;

  // auto-publish al primo salvataggio se entry è draft
  const publishedAt = profile?.attrs?.publishedAt ?? null;
  if (!publishedAt) patch.publishedAt = new Date().toISOString();

  // se non esiste, crealo ora (abbiamo nome/cognome validi)
  if (!profile) {
    const created = await createCustomerProfile(base, me.id, patch);
    if (!created) {
      const isDev = process.env.NODE_ENV !== "production";
      return jsonNoStore(
        { ok: false, error: "CREATE_FAILED", ...(isDev ? { debug: "CustomerProfile create failed" } : {}) },
        502
      );
    }

    return jsonNoStore(
      {
        ok: true,
        exists: true,
        email: me.email,
        customerType: normalizeCustomerType(created.attrs?.customerType ?? patch.customerType),
        firstName: String(created.attrs?.firstName ?? firstName),
        lastName: String(created.attrs?.lastName ?? lastName),
        shippingAddress: created.attrs?.shippingAddress ?? (addressHasAnyMeaningful(shippingAddress) ? shippingAddress : null),
        billingAddress: created.attrs?.billingAddress ?? (addressHasAnyMeaningful(billingAddress) ? billingAddress : null),
      },
      200
    );
  }

  const upd = await fetchJson(`${base}/api/customer-profiles/${profile.id}?publicationState=preview`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}`,
    },
    body: JSON.stringify({ data: patch }),
  });

  if (!upd.res.ok) {
    const isDev = process.env.NODE_ENV !== "production";
    return jsonNoStore(
      {
        ok: false,
        error: "UPDATE_FAILED",
        ...(isDev ? { debug: { status: upd.res.status, text: (upd.text || "").slice(0, 1200) } } : {}),
      },
      502
    );
  }

  const attrs = upd.json?.data?.attributes ?? {};

  return jsonNoStore(
    {
      ok: true,
      exists: true,
      email: me.email,
      customerType: normalizeCustomerType(attrs?.customerType ?? patch.customerType),
      firstName: String(attrs?.firstName ?? firstName),
      lastName: String(attrs?.lastName ?? lastName),
      shippingAddress: attrs?.shippingAddress ?? (addressHasAnyMeaningful(shippingAddress) ? shippingAddress : null),
      billingAddress: attrs?.billingAddress ?? (addressHasAnyMeaningful(billingAddress) ? billingAddress : null),
    },
    200
  );
}
