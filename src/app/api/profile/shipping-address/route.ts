// src/app/api/profile/shipping-address/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShippingAddress = {
  address: string;
  city: string;
  postalCode: string;
  province: string;
  country: string;
};

function jsonNoStore(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "x-profile-route": "shipping-address" },
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

function requireEnv(name: string, v: string) {
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
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

async function strapiApi(path: string, init: RequestInit) {
  const STRAPI_URL = requireEnv("STRAPI_URL", pickStrapiBaseUrl());
  const res = await fetchWithTimeout(`${STRAPI_URL}${path}`, init);
  const text = await res.text().catch(() => "");
  const data = safeJsonParse(text);
  return { res, data, text };
}

async function getUserMe(userJwt: string) {
  const r = await strapiApi("/api/users/me", {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${userJwt}` },
  });
  if (!r.res.ok) return null;
  return r.data;
}

async function findCustomerProfileByUserId(apiToken: string, userId: number) {
  // customer-profiles?filters[user][id][$eq]=...
  const qs = new URLSearchParams();
  qs.set("pagination[pageSize]", "1");
  qs.set("filters[user][id][$eq]", String(userId));

  const r = await strapiApi(`/api/customer-profiles?${qs.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${apiToken}` },
  });

  if (!r.res.ok) return null;
  const first = Array.isArray(r.data?.data) ? r.data.data[0] : null;
  return first ?? null;
}

function normalizeAddress(input: any): { ok: true; value: ShippingAddress } | { ok: false; error: string } {
  const src = input && typeof input === "object" ? input : {};

  const address = String(src.address ?? "").trim().slice(0, 120);
  const city = String(src.city ?? "").trim().slice(0, 80);
  const postalCode = String(src.postalCode ?? "").trim().replace(/\s+/g, "").slice(0, 10);
  const province = String(src.province ?? "").trim().slice(0, 24);
  const country = String(src.country ?? "IT").trim().slice(0, 2).toUpperCase() || "IT";

  if (address.length < 3) return { ok: false, error: "ADDRESS_INVALID" };
  if (city.length < 2) return { ok: false, error: "CITY_INVALID" };
  if (!/^\d{5}$/.test(postalCode)) return { ok: false, error: "CAP_INVALID" };
  if (province.length < 2) return { ok: false, error: "PROVINCE_INVALID" };

  return { ok: true, value: { address, city, postalCode, province, country } };
}

function pickShippingAddressFromProfile(profileRow: any): ShippingAddress | null {
  const a = profileRow?.attributes ?? profileRow ?? {};
  const sa = a?.shippingAddress ?? null; // component Address

  if (!sa || typeof sa !== "object") return null;

  const address = String(sa.address ?? "").trim();
  const city = String(sa.city ?? "").trim();
  const postalCode = String(sa.postalCode ?? "").trim();
  const province = String(sa.province ?? "").trim();
  const country = String(sa.country ?? "IT").trim() || "IT";

  const has = address && city && postalCode && province;
  if (!has) return { address, city, postalCode, province, country }; // ritorna anche se incompleto
  return { address, city, postalCode, province, country };
}

export async function GET(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const userJwt = getCookieValue(cookieHeader, "tf_token") || getCookieValue(cookieHeader, "jwtToken");
    if (!userJwt) return jsonNoStore({ ok: false, error: "UNAUTHENTICATED" }, 401);

    const apiToken = requireEnv("STRAPI_API_TOKEN", process.env.STRAPI_API_TOKEN || "");

    const me = await getUserMe(userJwt);
    const userId = typeof me?.id === "number" ? me.id : null;
    if (!userId) return jsonNoStore({ ok: false, error: "UNAUTHENTICATED" }, 401);

    const profile = await findCustomerProfileByUserId(apiToken, userId);
    if (!profile?.id) return jsonNoStore({ ok: true, hasAddress: false, address: null }, 200);

    const addr = pickShippingAddressFromProfile(profile);
    const hasAddress = !!(addr?.address && addr?.city && addr?.postalCode && addr?.province);

    return jsonNoStore({ ok: true, hasAddress, address: addr }, 200);
  } catch {
    return jsonNoStore({ ok: false, error: "PROFILE_ROUTE_FAILED" }, 500);
  }
}

export async function PUT(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const userJwt = getCookieValue(cookieHeader, "tf_token") || getCookieValue(cookieHeader, "jwtToken");
    if (!userJwt) return jsonNoStore({ ok: false, error: "UNAUTHENTICATED" }, 401);

    const apiToken = requireEnv("STRAPI_API_TOKEN", process.env.STRAPI_API_TOKEN || "");

    const me = await getUserMe(userJwt);
    const userId = typeof me?.id === "number" ? me.id : null;
    if (!userId) return jsonNoStore({ ok: false, error: "UNAUTHENTICATED" }, 401);

    const profile = await findCustomerProfileByUserId(apiToken, userId);
    const profileId = typeof profile?.id === "number" ? profile.id : null;
    if (!profileId) return jsonNoStore({ ok: false, error: "PROFILE_NOT_FOUND" }, 404);

    const raw = await req.text().catch(() => "");
    const body = safeJsonParse(raw);

    const norm = normalizeAddress(body);
    if (!norm.ok) return jsonNoStore({ ok: false, error: norm.error }, 400);

    const payload = {
      data: {
        shippingAddress: {
          address: norm.value.address,
          city: norm.value.city,
          postalCode: norm.value.postalCode,
          province: norm.value.province,
          country: norm.value.country,
        },
      },
    };

    const r = await strapiApi(`/api/customer-profiles/${encodeURIComponent(String(profileId))}`, {
      method: "PUT",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${apiToken}` },
      body: JSON.stringify(payload),
    });

    if (!r.res.ok) return jsonNoStore({ ok: false, error: "PROFILE_UPDATE_FAILED" }, 502);

    return jsonNoStore({ ok: true }, 200);
  } catch {
    return jsonNoStore({ ok: false, error: "PROFILE_ROUTE_FAILED" }, 500);
  }
}