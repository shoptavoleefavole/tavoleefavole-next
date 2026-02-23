// src/app/api/profile/addresses/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Address = {
  address: string;
  city: string;
  postalCode: string;
  province: string;
  country: string; // IT
};

function jsonNoStore(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "x-profile-route": "addresses" },
  });
}

function safeJsonParse(text: string) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function pickStrapiBaseUrl() {
  return String(process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "").replace(/\/+$/, "");
}

function getCookieValue(cookieHeader: string, name: string) {
  const parts = cookieHeader.split(";").map((p) => p.trim());
  const hit = parts.find((p) => p.startsWith(`${name}=`));
  if (!hit) return null;
  return decodeURIComponent(hit.slice(name.length + 1));
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 12_000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

async function strapiFetch(path: string, init: RequestInit) {
  const base = pickStrapiBaseUrl();
  if (!base) throw new Error("STRAPI_URL_MISSING");
  const res = await fetchWithTimeout(`${base}${path}`, init);
  const text = await res.text().catch(() => "");
  const data = safeJsonParse(text);
  return { res, data, text };
}

function capOk(cap: string) {
  const c = String(cap || "").replace(/\s+/g, "");
  return /^\d{5}$/.test(c);
}

function normalizeAddress(input: any): Address {
  const src = input && typeof input === "object" ? input : {};
  return {
    address: String(src.address ?? "").trim().slice(0, 120),
    city: String(src.city ?? "").trim().slice(0, 80),
    postalCode: String(src.postalCode ?? "").trim().replace(/\s+/g, "").slice(0, 10),
    province: String(src.province ?? "").trim().slice(0, 24),
    country: (String(src.country ?? "IT").trim().toUpperCase() || "IT").slice(0, 2),
  };
}

function validateAddress(a: Address): string | null {
  if (a.address.length < 3) return "ADDRESS_INVALID";
  if (a.city.length < 2) return "CITY_INVALID";
  if (!capOk(a.postalCode)) return "CAP_INVALID";
  if (a.province.length < 2) return "PROVINCE_INVALID";
  if (!a.country || a.country.length < 2) return "COUNTRY_INVALID";
  return null;
}

function pickAddrFromProfile(row: any, key: "shippingAddress" | "billingAddress"): Address | null {
  const a = row?.attributes ?? row ?? {};
  const v = a?.[key] ?? null;
  if (!v || typeof v !== "object") return null;

  return {
    address: String(v.address ?? "").trim(),
    city: String(v.city ?? "").trim(),
    postalCode: String(v.postalCode ?? "").trim(),
    province: String(v.province ?? "").trim(),
    country: String(v.country ?? "IT").trim() || "IT",
  };
}

async function getUserMe(userJwt: string) {
  const r = await strapiFetch("/api/users/me", {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${userJwt}` },
  });
  if (!r.res.ok) return null;
  return r.data;
}

async function findCustomerProfile(token: string, userId: number) {
  const qs = new URLSearchParams();
  qs.set("pagination[pageSize]", "1");
  qs.set("filters[user][id][$eq]", String(userId));
  qs.set("publicationState", "preview");

  const r = await strapiFetch(`/api/customer-profiles?${qs.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });

  if (!r.res.ok) return { ok: false as const, status: r.res.status };
  const first = Array.isArray(r.data?.data) ? r.data.data[0] : null;
  return { ok: true as const, row: first };
}

function getProfileKey(row: any): string | null {
  const id = typeof row?.id === "number" ? String(row.id) : null;
  const doc =
    typeof row?.documentId === "string"
      ? row.documentId
      : typeof row?.attributes?.documentId === "string"
      ? row.attributes.documentId
      : null;
  // ✅ preferisci id numerico
  return id || doc || null;
}

async function upsertProfile(token: string, userId: number, shippingAddress: Address, billingAddress: Address, existingRow: any) {
  const payload = { data: { user: userId, shippingAddress, billingAddress } };

  // se non esiste, crea
  if (!existingRow?.id && !existingRow?.documentId) {
    const created = await strapiFetch("/api/customer-profiles?publicationState=preview", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    return created.res.ok;
  }

  const key = getProfileKey(existingRow);
  if (!key) return false;

  const upd = await strapiFetch(`/api/customer-profiles/${encodeURIComponent(key)}?publicationState=preview`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return upd.res.ok;
}

export async function GET(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const userJwt = getCookieValue(cookieHeader, "tf_token") || getCookieValue(cookieHeader, "jwtToken");
    if (!userJwt) return jsonNoStore({ ok: false, error: "UNAUTHENTICATED" }, 401);

    const apiToken = String(process.env.STRAPI_API_TOKEN || "").trim();
    const token = apiToken || userJwt; // fallback (se hai permessi pubblici)

    const me = await getUserMe(userJwt);
    const userId = typeof me?.id === "number" ? me.id : null;
    if (!userId) return jsonNoStore({ ok: false, error: "UNAUTHENTICATED" }, 401);

    const prof = await findCustomerProfile(token, userId);
    if (!prof.ok) return jsonNoStore({ ok: false, error: "PROFILE_FIND_FAILED", status: prof.status }, 502);

    const row = prof.row;
    const shippingAddress = row ? pickAddrFromProfile(row, "shippingAddress") : null;
    const billingAddress = row ? pickAddrFromProfile(row, "billingAddress") : null;

    const hasShipping = !!(shippingAddress?.address && shippingAddress?.city && shippingAddress?.postalCode && shippingAddress?.province);
    const hasBilling = !!(billingAddress?.address && billingAddress?.city && billingAddress?.postalCode && billingAddress?.province);

    return jsonNoStore({ ok: true, shippingAddress, billingAddress, hasShipping, hasBilling }, 200);
  } catch {
    return jsonNoStore({ ok: false, error: "PROFILE_ROUTE_FAILED" }, 500);
  }
}

export async function PUT(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const userJwt = getCookieValue(cookieHeader, "tf_token") || getCookieValue(cookieHeader, "jwtToken");
    if (!userJwt) return jsonNoStore({ ok: false, error: "UNAUTHENTICATED" }, 401);

    const apiToken = String(process.env.STRAPI_API_TOKEN || "").trim();
    const token = apiToken || userJwt;

    const me = await getUserMe(userJwt);
    const userId = typeof me?.id === "number" ? me.id : null;
    if (!userId) return jsonNoStore({ ok: false, error: "UNAUTHENTICATED" }, 401);

    const raw = await req.text().catch(() => "");
    const body = safeJsonParse(raw) ?? {};

    const billingSameAsShipping = Boolean(body?.billingSameAsShipping);

    const ship = normalizeAddress(body?.shippingAddress);
    const shipErr = validateAddress(ship);
    if (shipErr) return jsonNoStore({ ok: false, error: `SHIPPING_${shipErr}` }, 400);

    const bill = billingSameAsShipping ? ship : normalizeAddress(body?.billingAddress);
    const billErr = validateAddress(bill);
    if (billErr) return jsonNoStore({ ok: false, error: `BILLING_${billErr}` }, 400);

    const prof = await findCustomerProfile(token, userId);
    if (!prof.ok) return jsonNoStore({ ok: false, error: "PROFILE_FIND_FAILED", status: prof.status }, 502);

    const ok = await upsertProfile(token, userId, ship, bill, prof.row);
    if (!ok) return jsonNoStore({ ok: false, error: "PROFILE_UPDATE_FAILED" }, 502);

    return jsonNoStore({ ok: true }, 200);
  } catch {
    return jsonNoStore({ ok: false, error: "PROFILE_ROUTE_FAILED" }, 500);
  }
}