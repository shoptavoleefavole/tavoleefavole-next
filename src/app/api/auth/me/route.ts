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

function emailHandle(email: unknown): string | null {
  const e = sanitizeInlineText(email, 160);
  if (!e) return null;
  const at = e.indexOf("@");
  if (at > 0) return e.slice(0, at);
  return e;
}

async function fetchJson(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const text = await res.text().catch(() => "");
  return { res, json: safeJsonParse(text) };
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tf_token")?.value || "";

  if (!token) {
    return jsonNoStore({ loggedIn: false, user: null, company: null }, 200);
  }

  const base = strapiBaseUrl();

  try {
    // 1) utente base (token utente)
    const me = await fetchJson(`${base}/api/users/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!me.res.ok || !me.json?.id) {
      const out = jsonNoStore({ loggedIn: false, user: null, company: null }, 200);
      // pulizia cookie best-effort
      out.cookies.set("tf_token", "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
      });
      out.cookies.set("tf_token", "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        expires: new Date(0),
      });
      return out;
    }

    const userId = Number(me.json.id);

    // 2) customer profile + azienda (service token per evitare permessi Public)
    let profile: any = null;
    let company: any = null;

    if (STRAPI_SERVICE_TOKEN) {
      // CustomerProfile: proviamo due filtri (user / users_permissions_user)
      const qs1 = new URLSearchParams();
      qs1.set("pagination[pageSize]", "1");
      qs1.set("filters[user][id][$eq]", String(userId));

      const p1 = await fetchJson(`${base}/api/customer-profiles?${qs1.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json", Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}` },
      });

      const p1row = Array.isArray(p1.json?.data) ? p1.json.data[0] : null;

      if (p1row) {
        profile = p1row?.attributes ?? p1row ?? null;
      } else {
        const qs2 = new URLSearchParams();
        qs2.set("pagination[pageSize]", "1");
        qs2.set("filters[users_permissions_user][id][$eq]", String(userId));

        const p2 = await fetchJson(`${base}/api/customer-profiles?${qs2.toString()}`, {
          method: "GET",
          headers: { Accept: "application/json", Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}` },
        });

        const p2row = Array.isArray(p2.json?.data) ? p2.json.data[0] : null;
        profile = p2row ? (p2row?.attributes ?? p2row ?? null) : null;
      }

      // Aziende: cerchiamo aziende collegate all'utente
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
          isApproved: typeof aa?.isApproved === "boolean" ? aa.isApproved : null,
          discountPercent: typeof aa?.discountPercent === "number" ? aa.discountPercent : null,
        };
      } else {
        // fallback: alcuni setup usano "user"
        const qsa2 = new URLSearchParams();
        qsa2.set("pagination[pageSize]", "1");
        qsa2.set("filters[user][id][$eq]", String(userId));

        const a2 = await fetchJson(`${base}/api/aziendes?${qsa2.toString()}`, {
          method: "GET",
          headers: { Accept: "application/json", Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}` },
        });

        const a2row = Array.isArray(a2.json?.data) ? a2.json.data[0] : null;
        if (a2row) {
          const aa = a2row?.attributes ?? a2row ?? {};
          company = {
            companyName: sanitizeInlineText(aa?.companyName, 140),
            isApproved: typeof aa?.isApproved === "boolean" ? aa.isApproved : null,
            discountPercent: typeof aa?.discountPercent === "number" ? aa.discountPercent : null,
          };
        }
      }
    }

    // accountType: preferisci profile.accountType se presente
    const accountType =
      sanitizeInlineText(profile?.accountType, 20) ??
      sanitizeInlineText(me.json?.accountType, 20) ??
      (company?.companyName ? "BUSINESS" : "PERSON");

    // Nome visualizzato:
    // - BUSINESS + companyName => ragione sociale
    // - altrimenti => firstName lastName (da profile) o handle email/username
    const firstName = sanitizeInlineText(profile?.firstName ?? me.json?.firstName, 60);
    const lastName = sanitizeInlineText(profile?.lastName ?? me.json?.lastName, 60);
    const fullName = `${firstName ?? ""} ${lastName ?? ""}`.trim();

    const username = sanitizeInlineText(me.json?.username, 80);
    const email = sanitizeInlineText(me.json?.email, 120);
    const emailNick = emailHandle(email);

    const display =
      accountType === "BUSINESS" && company?.companyName
        ? company.companyName
        : fullName ||
          username ||
          emailNick ||
          "Account";

    const user = {
      id: me.json?.id ?? null,
      username,
      email,
      firstName,
      lastName,
      accountType,
      displayName: display,
      companyName: company?.companyName ?? null,
    };

    return jsonNoStore({ loggedIn: true, user, company: company ?? null }, 200);
  } catch {
    return jsonNoStore({ loggedIn: false, user: null, company: null }, 200);
  }
}
