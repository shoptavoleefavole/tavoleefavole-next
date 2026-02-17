import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  return { id: Number(me.json.id), email: String(me.json.email ?? "") };
}

async function findCustomerProfile(base: string, userId: number) {
  const headers = { Accept: "application/json", Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}` };

  const qs1 = new URLSearchParams();
  qs1.set("pagination[pageSize]", "1");
  qs1.set("filters[user][id][$eq]", String(userId));
  const p1 = await fetchJson(`${base}/api/customer-profiles?${qs1.toString()}`, { method: "GET", headers });
  const row1 = Array.isArray(p1.json?.data) ? p1.json.data[0] : null;
  if (row1?.id) return { id: row1.id as number, attrs: row1.attributes ?? {} };

  const qs2 = new URLSearchParams();
  qs2.set("pagination[pageSize]", "1");
  qs2.set("filters[users_permissions_user][id][$eq]", String(userId));
  const p2 = await fetchJson(`${base}/api/customer-profiles?${qs2.toString()}`, { method: "GET", headers });
  const row2 = Array.isArray(p2.json?.data) ? p2.json.data[0] : null;
  if (row2?.id) return { id: row2.id as number, attrs: row2.attributes ?? {} };

  return null;
}

async function ensureCustomerProfileExists(base: string, userId: number) {
  // crea un profilo minimo, senza placeholder, con customerType default PRIVATE
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}`,
  };

  const payload1 = { data: { user: userId, customerType: "PRIVATE" } };
  const c1 = await fetchJson(`${base}/api/customer-profiles`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload1),
  });

  if (c1.res.ok && c1.json?.data?.id) {
    return { id: Number(c1.json.data.id), attrs: c1.json.data.attributes ?? {} };
  }

  // fallback: relazione users_permissions_user
  const payload2 = { data: { users_permissions_user: userId, customerType: "PRIVATE" } };
  const c2 = await fetchJson(`${base}/api/customer-profiles`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload2),
  });

  if (c2.res.ok && c2.json?.data?.id) {
    return { id: Number(c2.json.data.id), attrs: c2.json.data.attributes ?? {} };
  }

  return null;
}

export async function GET() {
  const cookieStore = await cookies();
  const jwt = cookieStore.get("tf_token")?.value || "";
  if (!jwt) return jsonNoStore({ ok: false, error: "UNAUTHORIZED" }, 401);

  if (!STRAPI_SERVICE_TOKEN) {
    return jsonNoStore({ ok: false, error: "SERVER_MISCONFIG" }, 500);
  }

  const base = strapiBaseUrl();
  const me = await getUserFromJwt(base, jwt);
  if (!me) return jsonNoStore({ ok: false, error: "UNAUTHORIZED" }, 401);

  let profile = await findCustomerProfile(base, me.id);
  if (!profile) {
    profile = await ensureCustomerProfileExists(base, me.id);
  }

  if (!profile) {
    // profilo non creato: ritorniamo comunque qualcosa di utile
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
  const cookieStore = await cookies();
  const jwt = cookieStore.get("tf_token")?.value || "";
  if (!jwt) return jsonNoStore({ ok: false, error: "UNAUTHORIZED" }, 401);

  if (!STRAPI_SERVICE_TOKEN) {
    return jsonNoStore({ ok: false, error: "SERVER_MISCONFIG" }, 500);
  }

  const base = strapiBaseUrl();
  const me = await getUserFromJwt(base, jwt);
  if (!me) return jsonNoStore({ ok: false, error: "UNAUTHORIZED" }, 401);

  const raw = await req.text().catch(() => "");
  const body = safeJsonParse(raw) ?? {};

  const firstName = sanitize(body?.firstName, 60);
  const lastName = sanitize(body?.lastName, 60);

  const shippingAddress = body?.shippingAddress ? normalizeAddress(body.shippingAddress) : null;
  const billingAddress = body?.billingAddress ? normalizeAddress(body.billingAddress) : null;

  // trova o crea profilo
  let profile = await findCustomerProfile(base, me.id);
  if (!profile) profile = await ensureCustomerProfileExists(base, me.id);

  if (!profile) {
    return jsonNoStore({ ok: false, error: "PROFILE_NOT_FOUND" }, 404);
  }

  const patch: any = {
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    shippingAddress: shippingAddress || undefined,
    billingAddress: billingAddress || undefined,
  };

  const upd = await fetchJson(`${base}/api/customer-profiles/${profile.id}`, {
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
        ...(isDev ? { debug: { status: upd.res.status, text: (upd.text || "").slice(0, 800) } } : {}),
      },
      502
    );
  }

  return jsonNoStore({ ok: true }, 200);
}
