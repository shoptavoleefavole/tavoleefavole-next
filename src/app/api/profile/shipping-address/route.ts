// src/app/api/profile/shipping-address/route.ts
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

async function strapiFetch(path: string, init: RequestInit) {
  const STRAPI_URL = requireEnv("STRAPI_URL", pickStrapiBaseUrl());
  const res = await fetchWithTimeout(`${STRAPI_URL}${path}`, init);
  const text = await res.text().catch(() => "");
  const data = safeJsonParse(text);
  return { res, data, text };
}

const IS_DEV = process.env.NODE_ENV !== "production";

function capOk(cap: string) {
  const c = String(cap || "").replace(/\s+/g, "");
  return /^\d{5}$/.test(c);
}

function normalizeAddress(input: any): { ok: true; value: Address } | { ok: false; error: string } {
  const src = input && typeof input === "object" ? input : {};
  const address = String(src.address ?? "").trim().slice(0, 120);
  const city = String(src.city ?? "").trim().slice(0, 80);
  const postalCode = String(src.postalCode ?? "").trim().replace(/\s+/g, "").slice(0, 10);
  const province = String(src.province ?? "").trim().slice(0, 24);
  const country = String(src.country ?? "IT").trim().slice(0, 2).toUpperCase() || "IT";

  if (address.length < 3) return { ok: false, error: "ADDRESS_INVALID" };
  if (city.length < 2) return { ok: false, error: "CITY_INVALID" };
  if (!capOk(postalCode)) return { ok: false, error: "CAP_INVALID" };
  if (province.length < 2) return { ok: false, error: "PROVINCE_INVALID" };

  return { ok: true, value: { address, city, postalCode, province, country } };
}

function pickShippingAddress(profileRow: any): Address | null {
  const a = profileRow?.attributes ?? profileRow ?? {};
  const sa = a?.shippingAddress ?? null;
  if (!sa || typeof sa !== "object") return null;

  return {
    address: String(sa.address ?? "").trim(),
    city: String(sa.city ?? "").trim(),
    postalCode: String(sa.postalCode ?? "").trim(),
    province: String(sa.province ?? "").trim(),
    country: String(sa.country ?? "IT").trim() || "IT",
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

async function findCustomerProfile(apiToken: string, userId: number) {
  const qs = new URLSearchParams();
  qs.set("pagination[pageSize]", "1");
  qs.set("filters[user][id][$eq]", String(userId));
  qs.set("publicationState", "preview");

  const r = await strapiFetch(`/api/customer-profiles?${qs.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${apiToken}` },
  });

  if (!r.res.ok) return { ok: false as const, status: r.res.status, text: r.text };
  const first = Array.isArray(r.data?.data) ? r.data.data[0] : null;
  return { ok: true as const, row: first };
}

function buildUpdatePayload(addr: Address) {
  return {
    data: {
      shippingAddress: {
        address: addr.address,
        city: addr.city,
        postalCode: addr.postalCode,
        province: addr.province,
        country: addr.country,
      },
    },
  };
}

async function putCustomerProfile(apiToken: string, identifier: string, addr: Address) {
  const payload = buildUpdatePayload(addr);

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

async function postCustomerProfile(apiToken: string, userId: number, addr: Address) {
  const payload = {
    data: {
      user: userId,
      shippingAddress: {
        address: addr.address,
        city: addr.city,
        postalCode: addr.postalCode,
        province: addr.province,
        country: addr.country,
      },
    },
  };

  return await strapiFetch(`/api/customer-profiles?publicationState=preview`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify(payload),
  });
}

function mapUpstreamError(status: number) {
  if (status === 401 || status === 403) return "STRAPI_TOKEN_FORBIDDEN";
  if (status === 404) return "PROFILE_NOT_FOUND";
  if (status === 400) return "STRAPI_VALIDATION_ERROR";
  return "PROFILE_UPDATE_FAILED";
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

    const prof = await findCustomerProfile(apiToken, userId);
    if (!prof.ok) {
      return jsonNoStore(
        {
          ok: false,
          error: "PROFILE_FIND_FAILED",
          status: prof.status,
          ...(IS_DEV ? { details: String(prof.text || "").slice(0, 500) } : {}),
        },
        502
      );
    }

    const row = prof.row;
    if (!row?.id) return jsonNoStore({ ok: true, hasAddress: false, address: null }, 200);

    const addr = pickShippingAddress(row);
    const hasAddress = !!(addr?.address && addr?.city && addr?.postalCode && addr?.province);

    return jsonNoStore({ ok: true, hasAddress, address: addr }, 200);
  } catch (e: any) {
    return jsonNoStore(
      { ok: false, error: "PROFILE_ROUTE_FAILED", ...(IS_DEV ? { details: String(e?.message || e) } : {}) },
      500
    );
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
    const body = safeJsonParse(raw);
    const norm = normalizeAddress(body);
    if (!norm.ok) return jsonNoStore({ ok: false, error: norm.error }, 400);

    const prof = await findCustomerProfile(apiToken, userId);
    if (!prof.ok) {
      return jsonNoStore(
        {
          ok: false,
          error: "PROFILE_FIND_FAILED",
          status: prof.status,
          ...(IS_DEV ? { details: String(prof.text || "").slice(0, 500) } : {}),
        },
        502
      );
    }

    const row = prof.row;

    // se non esiste profilo -> crealo
    if (!row?.id) {
      const created = await postCustomerProfile(apiToken, userId, norm.value);
      if (!created.res.ok) {
        return jsonNoStore(
          {
            ok: false,
            error: "PROFILE_CREATE_FAILED",
            status: created.res.status,
            ...(IS_DEV ? { details: String(created.text || "").slice(0, 500) } : {}),
          },
          502
        );
      }
      return jsonNoStore({ ok: true }, 200);
    }

    const id = typeof row?.id === "number" ? String(row.id) : null;
    const documentId =
      typeof row?.documentId === "string"
        ? row.documentId
        : typeof row?.attributes?.documentId === "string"
        ? row.attributes.documentId
        : null;

    // ✅ 1) prova update con ID numerico (più compatibile)
    if (id) {
      const r = await putCustomerProfile(apiToken, id, norm.value);
      if (r.res.ok) return jsonNoStore({ ok: true }, 200);

      // se 404 e abbiamo documentId, proviamo quello come fallback
      if (r.res.status === 404 && documentId) {
        const r2 = await putCustomerProfile(apiToken, documentId, norm.value);
        if (r2.res.ok) return jsonNoStore({ ok: true }, 200);

        return jsonNoStore(
          {
            ok: false,
            error: mapUpstreamError(r2.res.status),
            status: r2.res.status,
            ...(IS_DEV ? { details: String(r2.text || "").slice(0, 500) } : {}),
          },
          502
        );
      }

      return jsonNoStore(
        {
          ok: false,
          error: mapUpstreamError(r.res.status),
          status: r.res.status,
          ...(IS_DEV ? { details: String(r.text || "").slice(0, 500) } : {}),
        },
        502
      );
    }

    // ✅ 2) fallback: documentId
    if (documentId) {
      const r = await putCustomerProfile(apiToken, documentId, norm.value);
      if (r.res.ok) return jsonNoStore({ ok: true }, 200);

      return jsonNoStore(
        {
          ok: false,
          error: mapUpstreamError(r.res.status),
          status: r.res.status,
          ...(IS_DEV ? { details: String(r.text || "").slice(0, 500) } : {}),
        },
        502
      );
    }

    return jsonNoStore({ ok: false, error: "PROFILE_NOT_FOUND" }, 404);
  } catch (e: any) {
    return jsonNoStore(
      { ok: false, error: "PROFILE_ROUTE_FAILED", ...(IS_DEV ? { details: String(e?.message || e) } : {}) },
      500
    );
  }
}