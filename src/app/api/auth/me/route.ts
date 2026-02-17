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
    headers: {
      "Cache-Control": "no-store",
      Vary: "Cookie",
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

function sanitizeInlineText(input: unknown, maxLen = 80): string | null {
  const raw = String(input ?? "");
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen)}…` : cleaned;
}

async function fetchJson(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const text = await res.text().catch(() => "");
  return { res, json: safeJsonParse(text), text };
}

function normalizeCustomerType(v: any): "PRIVATE" | "BUSINESS" | null {
  const s = String(v ?? "").toUpperCase().trim();
  if (s === "BUSINESS") return "BUSINESS";
  if (s === "PRIVATE" || s === "PERSON") return "PRIVATE";
  return null;
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tf_token")?.value || "";

  if (!token) return jsonNoStore({ loggedIn: false, user: null, company: null }, 200);

  const base = strapiBaseUrl();

  try {
    // 1) user base via jwt utente
    const me = await fetchJson(`${base}/api/users/me`, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });

    if (!me.res.ok || !me.json?.id) {
      const out = jsonNoStore({ loggedIn: false, user: null, company: null }, 200);
      out.cookies.set("tf_token", "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
      });
      return out;
    }

    const userId = Number(me.json.id);

    // 2) CustomerProfile + Azienda via service token
    let profile: any = null;
    let company: any = null;

    if (STRAPI_SERVICE_TOKEN) {
      // CustomerProfile: prova user
      const qs1 = new URLSearchParams();
      qs1.set("pagination[pageSize]", "1");
      qs1.set("filters[user][id][$eq]", String(userId));
      const p1 = await fetchJson(`${base}/api/customer-profiles?${qs1.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json", Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}` },
      });

      const p1row = Array.isArray(p1.json?.data) ? p1.json.data[0] : null;
      if (p1row) profile = p1row?.attributes ?? p1row ?? null;

      // fallback users_permissions_user
      if (!profile) {
        const qs2 = new URLSearchParams();
        qs2.set("pagination[pageSize]", "1");
        qs2.set("filters[users_permissions_user][id][$eq]", String(userId));
        const p2 = await fetchJson(`${base}/api/customer-profiles?${qs2.toString()}`, {
          method: "GET",
          headers: { Accept: "application/json", Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}` },
        });
        const p2row = Array.isArray(p2.json?.data) ? p2.json.data[0] : null;
        if (p2row) profile = p2row?.attributes ?? p2row ?? null;
      }

      // Aziende: prova relazione users_permissions_users
      const qsa = new URLSearchParams();
      qsa.set("pagination[pageSize]", "1");
      qsa.set("filters[users_permissions_users][id][$eq]", String(userId));
      const a1 = await fetchJson(`${base}/api/aziendes?${qsa.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json", Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}` },
      });
      const a1row = Array.isArray(a1.json?.data) ? a1.json.data[0] : null;

      if (a1row) {
        const aa = a1row?.attributes ?? a1row ?? {};
        company = {
          companyName: sanitizeInlineText(aa?.companyName, 140),
          vatNumber: sanitizeInlineText(aa?.vatNumber, 40),
          sdi: sanitizeInlineText(aa?.sdi, 20),
          pec: sanitizeInlineText(aa?.pec, 120),
        };
      }
    }

    const customerType = normalizeCustomerType(profile?.customerType) ?? (company?.companyName ? "BUSINESS" : "PRIVATE");

    const firstName = sanitizeInlineText(profile?.firstName, 60);
    const lastName = sanitizeInlineText(profile?.lastName, 60);
    const fullName = `${firstName ?? ""} ${lastName ?? ""}`.trim();

    const displayName =
      customerType === "BUSINESS" && company?.companyName
        ? company.companyName
        : fullName ||
          sanitizeInlineText(me.json?.username, 80) ||
          sanitizeInlineText(me.json?.email, 120) ||
          "Account";

    const user = {
      id: me.json?.id ?? null,
      email: sanitizeInlineText(me.json?.email, 120),
      username: sanitizeInlineText(me.json?.username, 80),
      firstName,
      lastName,
      customerType, // PRIVATE | BUSINESS
      displayName,
    };

    return jsonNoStore({ loggedIn: true, user, company: company ?? null }, 200);
  } catch {
    return jsonNoStore({ loggedIn: false, user: null, company: null }, 200);
  }
}
