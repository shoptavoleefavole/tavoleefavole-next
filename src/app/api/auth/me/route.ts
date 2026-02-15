import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function strapiBaseUrl() {
  const raw =
    process.env.STRAPI_URL ||
    process.env.NEXT_PUBLIC_STRAPI_URL ||
    "http://localhost:1337";
  return String(raw).replace(/\/+$/, "");
}

function jsonNoStore(body: any, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function safeJsonParse(text: string) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

type MeUser = {
  id: number;
  username?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  accountType?: string | null;
};

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tf_token")?.value;

  // ✅ no token => non loggato
  if (!token) {
    return jsonNoStore({ loggedIn: false, user: null, company: null });
  }

  const baseUrl = strapiBaseUrl();

  // 1) /users/me
  let user: MeUser | null = null;

  try {
    const meRes = await fetch(`${baseUrl}/api/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!meRes.ok) {
      // ✅ token non valido / scaduto / strapi giù
      return jsonNoStore({ loggedIn: false, user: null, company: null });
    }

    const meJson = await meRes.json().catch(() => null);

    if (meJson && typeof meJson?.id === "number") {
      user = {
        id: meJson.id,
        username: meJson.username ?? null,
        email: meJson.email ?? null,
        firstName: meJson.firstName ?? null,
        lastName: meJson.lastName ?? null,
        accountType: meJson.accountType ?? null,
      };
    } else {
      return jsonNoStore({ loggedIn: false, user: null, company: null });
    }
  } catch {
    return jsonNoStore({ loggedIn: false, user: null, company: null });
  }

  // ✅ guardia extra (TypeScript + robustezza)
  if (!user) {
    return jsonNoStore({ loggedIn: false, user: null, company: null });
  }

  // 2) Azienda (opzionale)
  // Non deve bloccare la risposta /me se fallisce
  let company: any = null;

  try {
    const COMPANIES_PATH = "/api/companies";

    // 🔒 sicurezza: usiamo encodeURIComponent e stringhe safe
    const url =
      `${baseUrl}${COMPANIES_PATH}` +
      `?filters[users_permissions_users][id][$eq]=${encodeURIComponent(String(user.id))}` +
      `&pagination[pageSize]=1`;

    const cRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (cRes.ok) {
      const text = await cRes.text().catch(() => "");
      const json = safeJsonParse(text);
      const row = Array.isArray(json?.data) ? json.data[0] : null;
      if (row) company = row;
    }
  } catch {
    company = null;
  }

  return jsonNoStore({ loggedIn: true, user, company });
}
