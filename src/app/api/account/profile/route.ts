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
    base.includes("localhost") || base.includes("127.0.0.1") || base.includes("0.0.0.0");

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
    headers: { "Cache-Control": "no-store", Vary: "Cookie" },
  });
}

function safeJsonParse(text: string) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function sanitize(input: unknown, maxLen = 160): string {
  const raw = String(input ?? "");
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
}

function normalizeCustomerType(v: any): "PRIVATE" | "BUSINESS" {
  return String(v ?? "").toUpperCase() === "BUSINESS" ? "BUSINESS" : "PRIVATE";
}

async function fetchJson(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const text = await res.text().catch(() => "");
  return { res, json: safeJsonParse(text), text };
}

async function getUserIdFromJwt(base: string, jwt: string) {
  const me = await fetchJson(`${base}/api/users/me`, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${jwt}` },
  });
  if (!me.res.ok || !me.json?.id) return null;
  return { id: Number(me.json.id), email: me.json?.email ?? null };
}

async function findCustomerProfile(base: string, userId: number) {
  const headers = { Accept: "application/json", Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}` };

  const qs1 = new URLSearchParams();
  qs1.set("pagination[pageSize]", "1");
  qs1.set("filters[user][id][$eq]", String(userId));
  const p1 = await fetchJson(`${base}/api/customer-profiles?${qs1.toString()}`, { method: "GET", headers });
  const row1 = Array.isArray(p1.json?.data) ? p1.json.data[0] : null;
  if (row1) return { id: row1.id, attrs: row1.attributes ?? {} };

  const qs2 = new URLSearchParams();
  qs2.set("pagination[pageSize]", "1");
  qs2.set("filters[users_permissions_user][id][$eq]", String(userId));
  const p2 = await fetchJson(`${base}/api/customer-profiles?${qs2.toString()}`, { method: "GET", headers });
  const row2 = Array.isArray(p2.json?.data) ? p2.json.data[0] : null;
  if (row2) return { id: row2.id, attrs: row2.attributes ?? {} };

  return null;
}

export async function GET() {
  const cookieStore = await cookies();
  const jwt = cookieStore.get("tf_token")?.value || "";
  if (!jwt) return jsonNoStore({ ok: false, error: "UNAUTHORIZED" }, 401);

  const base = strapiBaseUrl();
  if (!STRAPI_SERVICE_TOKEN) return jsonNoStore({ ok: false, error: "SERVER_MISCONFIG" }, 500);

  const me = await getUserIdFromJwt(base, jwt);
  if (!me) return jsonNoStore({ ok: false, error: "UNAUTHORIZED" }, 401);

  const profile = await findCustomerProfile(base, me.id);
  if (!profile) {
    // profilo mancante: il frontend può guidare al completamento, ma qui rispondiamo vuoto
    return jsonNoStore({
      ok: true,
      exists: false,
      email: me.email,
      customerType: "PRIVATE",
      firstName: "",
      lastName: "",
      shippingAddress: null,
      billingAddress: null,
    });
  }

  return jsonNoStore({
    ok: true,
    exists: true,
    email: me.email,
    customerType: normalizeCustomerType(profile.attrs?.customerType),
    firstName: profile.attrs?.firstName ?? "",
    lastName: profile.attrs?.lastName ?? "",
    shippingAddress: profile.attrs?.shippingAddress ?? null,
    billingAddress: profile.attrs?.billingAddress ?? null,
  });
}

export async function PUT(req: Request) {
  const cookieStore = await cookies();
  const jwt = cookieStore.get("tf_token")?.value || "";
  if (!jwt) return jsonNoStore({ ok: false, error: "UNAUTHORIZED" }, 401);

  const base = strapiBaseUrl();
  if (!STRAPI_SERVICE_TOKEN) return jsonNoStore({ ok: false, error: "SERVER_MISCONFIG" }, 500);

  const me = await getUserIdFromJwt(base, jwt);
  if (!me) return jsonNoStore({ ok: false, error: "UNAUTHORIZED" }, 401);

  const raw = await req.text().catch(() => "");
  const body = safeJsonParse(raw) ?? {};

  // sanitizzazione campi base
  const firstName = sanitize(body?.firstName, 60);
  const lastName = sanitize(body?.lastName, 60);

  const shippingAddress = body?.shippingAddress && typeof body.shippingAddress === "object"
    ? {
        address: sanitize(body.shippingAddress.address, 160),
        city: sanitize(body.shippingAddress.city, 80),
        postalCode: sanitize(body.shippingAddress.postalCode, 12),
        province: sanitize(body.shippingAddress.province, 40),
        country: sanitize(body.shippingAddress.country || "IT", 2),
      }
    : null;

  const billingAddress = body?.billingAddress && typeof body.billingAddress === "object"
    ? {
        address: sanitize(body.billingAddress.address, 160),
        city: sanitize(body.billingAddress.city, 80),
        postalCode: sanitize(body.billingAddress.postalCode, 12),
        province: sanitize(body.billingAddress.province, 40),
        country: sanitize(body.billingAddress.country || "IT", 2),
      }
    : null;

  // trova profilo
  const found = await findCustomerProfile(base, me.id);
  if (!found) return jsonNoStore({ ok: false, error: "PROFILE_NOT_FOUND" }, 404);

  const patch = {
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    shippingAddress: shippingAddress || undefined,
    billingAddress: billingAddress || undefined,
  };

  const upd = await fetchJson(`${base}/api/customer-profiles/${found.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}`,
    },
    body: JSON.stringify({ data: patch }),
  });

  if (!upd.res.ok) {
    return jsonNoStore({ ok: false, error: "UPDATE_FAILED" }, 502);
  }

  return jsonNoStore({ ok: true }, 200);
}
