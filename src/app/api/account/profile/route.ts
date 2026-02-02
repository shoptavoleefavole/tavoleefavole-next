import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store", Vary: "Cookie", "x-profile-route": "v1" },
  });
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function strapiBaseUrl() {
  return (process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337").replace(
    /\/+$/,
    ""
  );
}

async function getUserJwtFromCookies() {
  const store = await cookies();
  return store.get("tf_token")?.value || store.get("jwtToken")?.value || null;
}

async function fetchWithTimeout(url: string, init: RequestInit, ms = 10_000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

function pickStr(v: any, max = 140) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max) : s;
}

function sanitizeProfile(input: any) {
  const src = input && typeof input === "object" ? input : {};

  // campi “spedizione / billing”
  const billingType = pickStr(src.billingType, 20).toUpperCase() === "AZIENDE" ? "AZIENDE" : "PRIVATE";

  const profile = {
    billingType,
    firstName: pickStr(src.firstName),
    lastName: pickStr(src.lastName),
    fiscalCode: pickStr(src.fiscalCode, 32),
    phone: pickStr(src.phone, 32),

    address: pickStr(src.address, 180),
    city: pickStr(src.city, 80),
    postalCode: pickStr(src.postalCode, 24),
    province: pickStr(src.province, 40),
    country: pickStr(src.country, 2) || "IT",

    companyName: pickStr(src.companyName, 140),
    vatNumber: pickStr(src.vatNumber, 40),
    sdi: pickStr(src.sdi, 32),
    pec: pickStr(src.pec, 140),

    email: pickStr(src.email, 140),
  };

  return profile;
}

export async function GET() {
  const STRAPI_URL = strapiBaseUrl();

  const userJwt = await getUserJwtFromCookies();
  if (!userJwt) return json({ ok: false, error: "Not authenticated" }, 401);

  try {
    const meRes = await fetchWithTimeout(`${STRAPI_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${userJwt}` },
    });

    const text = await meRes.text().catch(() => "");
    const me = safeJsonParse(text);

    if (!meRes.ok) {
      return json({ ok: false, error: "Unauthorized (users/me)", status: meRes.status, details: me ?? text }, 401);
    }

    // ritorniamo tutto ciò che c’è (anche campi custom se li aggiungi a User)
    return json({ ok: true, me }, 200);
  } catch (e: any) {
    const isAbort = e?.name === "AbortError";
    return json({ ok: false, error: isAbort ? "Timeout contacting Strapi" : "Strapi unreachable", details: e?.message }, 502);
  }
}

export async function PUT(req: Request) {
  const STRAPI_URL = strapiBaseUrl();
  const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

  const userJwt = await getUserJwtFromCookies();
  if (!userJwt) return json({ ok: false, error: "Not authenticated" }, 401);

  const raw = await req.text().catch(() => "");
  const body = safeJsonParse(raw);
  const profile = sanitizeProfile(body);

  // 1) scopri userId
  let userId: number | null = null;
  try {
    const meRes = await fetchWithTimeout(`${STRAPI_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${userJwt}` },
    });

    const text = await meRes.text().catch(() => "");
    const me = safeJsonParse(text);

    if (!meRes.ok) {
      return json({ ok: false, error: "Unauthorized (users/me)", status: meRes.status, details: me ?? text }, 401);
    }

    if (typeof me?.id === "number") userId = me.id;
    if (typeof me?.id === "string" && /^\d+$/.test(me.id)) userId = Number(me.id);
  } catch (e: any) {
    return json({ ok: false, error: "Could not determine user id", details: e?.message }, 500);
  }

  if (!userId) return json({ ok: false, error: "Could not determine user id" }, 500);

  // 2) prova update con JWT utente (preferito)
  const updatePayload = { ...profile };

  async function tryUpdate(bearer: string) {
    const res = await fetchWithTimeout(`${STRAPI_URL}/api/users/${userId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
      body: JSON.stringify(updatePayload),
    });

    const text = await res.text().catch(() => "");
    const data = safeJsonParse(text);
    return { res, data, text };
  }

  try {
    const first = await tryUpdate(userJwt);
    if (first.res.ok) return json({ ok: true, saved: true }, 200);

    // 3) fallback con API token (se disponibile)
    if (STRAPI_API_TOKEN) {
      const second = await tryUpdate(STRAPI_API_TOKEN);
      if (second.res.ok) return json({ ok: true, saved: true, via: "api_token" }, 200);

      return json(
        {
          ok: false,
          error: "Profile update failed on Strapi",
          status: second.res.status,
          hint:
            "Se fallisce con 401/403: abilita in Strapi → Settings → Users & Permissions → Roles → Authenticated → User: update (oppure usa un content-type Profile dedicato).",
          details: second.data ?? second.text?.slice(0, 1500),
        },
        second.res.status
      );
    }

    return json(
      {
        ok: false,
        error: "Profile update failed on Strapi",
        status: first.res.status,
        hint:
          "Se fallisce con 401/403: abilita in Strapi → Settings → Users & Permissions → Roles → Authenticated → User: update.",
        details: first.data ?? first.text?.slice(0, 1500),
      },
      first.res.status
    );
  } catch (e: any) {
    const isAbort = e?.name === "AbortError";
    return json({ ok: false, error: isAbort ? "Timeout contacting Strapi" : "Strapi unreachable", details: e?.message }, 502);
  }
}
