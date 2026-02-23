// src/app/api/profile/addresses/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Address = {
  address: string;
  city: string;
  postalCode: string;
  province: string;
  country: string;
};

type Body = {
  shippingAddress?: Partial<Address> | null;
  billingAddress?: Partial<Address> | null;
  billingSameAsShipping?: boolean;
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

async function strapiFetch(path: string, init: RequestInit) {
  const STRAPI_URL = requireEnv("STRAPI_URL", pickStrapiBaseUrl());
  const res = await fetchWithTimeout(`${STRAPI_URL}${path}`, init);
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
    country: String(src.country ?? "IT").trim().slice(0, 2).toUpperCase() || "IT",
  };
}

function isComplete(a: Address) {
  return a.address.length >= 3 && a.city.length >= 2 && capOk(a.postalCode) && a.province.length >= 2;
}

function pickComponent(row: any, key: "shippingAddress" | "billingAddress"): Address | null {
  const a = row?.attributes ?? row ?? {};
  const c = a?.[key] ?? null;
  if (!c || typeof c !== "object") return null;

  return normalizeAddress(c);
}

async function getUserMe(userJwt: string) {
  const r = await strapiFetch("/api/users/me", {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${userJwt}` },
  });
  if (!r.res.ok) return null;
  return r.data;
}

async function findCustomerProfile(apiToken: string, userId: number) {
  const qs = new URLSearchParams();
  qs.set("pagination[pageSize]", "1");
  qs.set("filters[user][id][$eq]", String(userId));
  qs.set("publicationState", "preview");

  const r = await strapiFetch(`/api/customer-profiles?${qs.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${apiToken}` },
  });

  if (!r.res.ok) return null;
  return Array.isArray(r.data?.data) ? r.data.data[0] : null;
}

function getIdentifiers(row: any) {
  const id = typeof row?.id === "number" ? String(row.id) : null;
  const documentId =
    typeof row?.documentId === "string"
      ? row.documentId
      : typeof row?.attributes?.documentId === "string"
      ? row.attributes.documentId
      : null;
  return { id, documentId };
}

async function putCustomerProfile(apiToken: string, identifier: string, payload: any) {
  return await strapiFetch(`/api/customer-profiles/${encodeURIComponent(identifier)}?publicationState=preview`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify(payload),
  });
}

async function postCustomerProfile(apiToken: string, userId: number, payload: any) {
  return await strapiFetch(`/api/customer-profiles?publicationState=preview`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({ data: { user: userId, ...payload.data } }),
  });
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

    const profile = await findCustomerProfile(apiToken, userId);
    if (!profile?.id) {
      return jsonNoStore({ ok: true, shippingAddress: null, billingAddress: null }, 200);
    }

    const shippingAddress = pickComponent(profile, "shippingAddress");
    const billingAddress = pickComponent(profile, "billingAddress");

    return jsonNoStore(
      {
        ok: true,
        shippingAddress,
        billingAddress,
        hasShipping: !!(shippingAddress && isComplete(shippingAddress)),
        hasBilling: !!(billingAddress && isComplete(billingAddress)),
      },
      200
    );
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

    const raw = await req.text().catch(() => "");
    const body = (safeJsonParse(raw) ?? {}) as Body;

    const shipping = body.shippingAddress ? normalizeAddress(body.shippingAddress) : null;
    const billingSame = Boolean(body.billingSameAsShipping);
    const billing = billingSame
      ? shipping
      : body.billingAddress
      ? normalizeAddress(body.billingAddress)
      : null;

    // validazione minima: se presenti, devono essere completi
    if (shipping && !isComplete(shipping)) return jsonNoStore({ ok: false, error: "SHIPPING_INVALID" }, 400);
    if (billing && !isComplete(billing)) return jsonNoStore({ ok: false, error: "BILLING_INVALID" }, 400);

    const payload = {
      data: {
        ...(shipping ? { shippingAddress: shipping } : {}),
        ...(billing ? { billingAddress: billing } : {}),
      },
    };

    const profile = await findCustomerProfile(apiToken, userId);

    // se non esiste, crealo
    if (!profile?.id) {
      const created = await postCustomerProfile(apiToken, userId, payload);
      if (!created.res.ok) return jsonNoStore({ ok: false, error: "PROFILE_CREATE_FAILED", status: created.res.status }, 502);
      return jsonNoStore({ ok: true }, 200);
    }

    const { id, documentId } = getIdentifiers(profile);

    // prova prima con id numerico, poi documentId
    if (id) {
      const r = await putCustomerProfile(apiToken, id, payload);
      if (r.res.ok) return jsonNoStore({ ok: true }, 200);
      if (r.res.status === 404 && documentId) {
        const r2 = await putCustomerProfile(apiToken, documentId, payload);
        if (r2.res.ok) return jsonNoStore({ ok: true }, 200);
        return jsonNoStore({ ok: false, error: "PROFILE_UPDATE_FAILED", status: r2.res.status }, 502);
      }
      return jsonNoStore({ ok: false, error: "PROFILE_UPDATE_FAILED", status: r.res.status }, 502);
    }

    if (documentId) {
      const r = await putCustomerProfile(apiToken, documentId, payload);
      if (!r.res.ok) return jsonNoStore({ ok: false, error: "PROFILE_UPDATE_FAILED", status: r.res.status }, 502);
      return jsonNoStore({ ok: true }, 200);
    }

    return jsonNoStore({ ok: false, error: "PROFILE_NOT_FOUND" }, 404);
  } catch {
    return jsonNoStore({ ok: false, error: "PROFILE_ROUTE_FAILED" }, 500);
  }
}