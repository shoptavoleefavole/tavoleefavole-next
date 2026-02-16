import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonNoStore(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store", Vary: "Cookie" },
  });
}

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

function safeJsonParse(text: string) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function clamp(v: any, max = 120) {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max) : s;
}

async function fetchJson(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const text = await res.text().catch(() => "");
  return { res, json: safeJsonParse(text) };
}

async function getMe(base: string, jwt: string) {
  const r = await fetchJson(`${base}/api/users/me`, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${jwt}` },
  });
  return r.res.ok ? r.json : null;
}

async function getCustomerProfileId(base: string, userId: number) {
  // tentativo 1: field "user"
  const qs1 = new URLSearchParams();
  qs1.set("pagination[pageSize]", "1");
  qs1.set("filters[user][id][$eq]", String(userId));
  let r = await fetchJson(`${base}/api/customer-profiles?${qs1.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}` },
  });
  let row = Array.isArray(r.json?.data) ? r.json.data[0] : null;
  if (row?.id) return Number(row.id);

  // tentativo 2: field "users_permissions_user"
  const qs2 = new URLSearchParams();
  qs2.set("pagination[pageSize]", "1");
  qs2.set("filters[users_permissions_user][id][$eq]", String(userId));
  r = await fetchJson(`${base}/api/customer-profiles?${qs2.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}` },
  });
  row = Array.isArray(r.json?.data) ? r.json.data[0] : null;
  return row?.id ? Number(row.id) : null;
}

async function getAziendaId(base: string, userId: number) {
  const qs1 = new URLSearchParams();
  qs1.set("pagination[pageSize]", "1");
  qs1.set("filters[users_permissions_users][id][$eq]", String(userId));
  let r = await fetchJson(`${base}/api/aziendes?${qs1.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}` },
  });
  let row = Array.isArray(r.json?.data) ? r.json.data[0] : null;
  if (row?.id) return Number(row.id);

  const qs2 = new URLSearchParams();
  qs2.set("pagination[pageSize]", "1");
  qs2.set("filters[user][id][$eq]", String(userId));
  r = await fetchJson(`${base}/api/aziendes?${qs2.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}` },
  });
  row = Array.isArray(r.json?.data) ? r.json.data[0] : null;
  return row?.id ? Number(row.id) : null;
}

export async function GET() {
  try {
    if (!STRAPI_SERVICE_TOKEN) return jsonNoStore({ ok: false, error: "MISSING_SERVICE_TOKEN" }, 500);

    const jwt = (await cookies()).get("tf_token")?.value || "";
    if (!jwt) return jsonNoStore({ ok: false, error: "UNAUTHENTICATED" }, 401);

    const base = strapiBaseUrl();
    const me = await getMe(base, jwt);
    const userId = Number(me?.id ?? 0);
    if (!userId) return jsonNoStore({ ok: false, error: "UNAUTHENTICATED" }, 401);

    const profileId = await getCustomerProfileId(base, userId);
    const aziendaId = await getAziendaId(base, userId);

    let profileData: any = null;
    if (profileId) {
      const r = await fetchJson(`${base}/api/customer-profiles/${profileId}`, {
        method: "GET",
        headers: { Accept: "application/json", Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}` },
      });
      profileData = r.json?.data?.attributes ?? null;
    }

    let aziendaData: any = null;
    if (aziendaId) {
      const r = await fetchJson(`${base}/api/aziendes/${aziendaId}`, {
        method: "GET",
        headers: { Accept: "application/json", Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}` },
      });
      aziendaData = r.json?.data?.attributes ?? null;
    }

    const type = String(profileData?.accountType ?? "").toUpperCase() === "BUSINESS" ? "BUSINESS" : "PERSON";

    return jsonNoStore({
      ok: true,
      type,
      email: String(me?.email ?? ""),
      firstName: String(profileData?.firstName ?? ""),
      lastName: String(profileData?.lastName ?? ""),
      companyName: String(aziendaData?.companyName ?? ""),
      vatNumber: String(aziendaData?.vatNumber ?? ""),
      sdi: String(aziendaData?.sdi ?? ""),
      pec: String(aziendaData?.pec ?? ""),
    });
  } catch {
    return jsonNoStore({ ok: false, error: "UNHANDLED" }, 500);
  }
}

export async function PUT(req: Request) {
  try {
    if (!STRAPI_SERVICE_TOKEN) return jsonNoStore({ ok: false, error: "MISSING_SERVICE_TOKEN" }, 500);

    const jwt = (await cookies()).get("tf_token")?.value || "";
    if (!jwt) return jsonNoStore({ ok: false, error: "UNAUTHENTICATED" }, 401);

    const raw = await req.text().catch(() => "");
    if (raw.length > 32 * 1024) return jsonNoStore({ ok: false, error: "PAYLOAD_TOO_LARGE" }, 413);
    const body = safeJsonParse(raw) ?? {};

    const base = strapiBaseUrl();
    const me = await getMe(base, jwt);
    const userId = Number(me?.id ?? 0);
    if (!userId) return jsonNoStore({ ok: false, error: "UNAUTHENTICATED" }, 401);

    const type = String(body?.type ?? "").toUpperCase() === "BUSINESS" ? "BUSINESS" : "PERSON";

    const firstName = clamp(body?.firstName, 60);
    const lastName = clamp(body?.lastName, 60);

    const companyName = clamp(body?.companyName, 140);
    const vatNumber = clamp(body?.vatNumber ?? body?.vat, 40);
    const sdi = clamp(body?.sdi, 20);
    const pec = clamp(body?.pec, 120);

    if (type === "BUSINESS" && !companyName) return jsonNoStore({ ok: false, error: "MISSING_COMPANY" }, 400);

    // customer profile upsert
    const profileId = await getCustomerProfileId(base, userId);
    if (profileId) {
      await fetch(`${base}/api/customer-profiles/${profileId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}` },
        body: JSON.stringify({ data: { firstName: firstName || undefined, lastName: lastName || undefined, accountType: type } }),
        cache: "no-store",
      });
    } else {
      await fetch(`${base}/api/customer-profiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}` },
        body: JSON.stringify({ data: { firstName: firstName || undefined, lastName: lastName || undefined, accountType: type, user: userId } }),
        cache: "no-store",
      });
    }

    // azienda upsert (solo business)
    if (type === "BUSINESS") {
      const aziendaId = await getAziendaId(base, userId);
      const data = { companyName: companyName || undefined, vatNumber: vatNumber || undefined, sdi: sdi || undefined, pec: pec || undefined };

      if (aziendaId) {
        await fetch(`${base}/api/aziendes/${aziendaId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}` },
          body: JSON.stringify({ data }),
          cache: "no-store",
        });
      } else {
        await fetch(`${base}/api/aziendes`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}` },
          body: JSON.stringify({ data: { ...data, users_permissions_users: [userId] } }),
          cache: "no-store",
        });
      }
    }

    return jsonNoStore({ ok: true }, 200);
  } catch {
    return jsonNoStore({ ok: false, error: "UNHANDLED" }, 500);
  }
}
