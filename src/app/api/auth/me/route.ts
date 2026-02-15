import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function strapiBaseUrl() {
  return (
    process.env.STRAPI_URL ||
    process.env.NEXT_PUBLIC_STRAPI_URL ||
    "http://localhost:1337"
  ).replace(/\/+$/, "");
}

// ✅ imposta questo env su Vercel/local
// Esempi: "/api/aziendes" oppure "/api/aziende"
const COMPANIES_PATH = process.env.STRAPI_COMPANIES_PATH || "/api/aziendes";

function pickSafeUser(me: any) {
  if (!me || typeof me !== "object") return null;
  return {
    id: me.id ?? null,
    username: me.username ?? null,
    email: me.email ?? null,
    firstName: me.firstName ?? null,
    lastName: me.lastName ?? null,
  };
}

function pickSafeCompany(row: any) {
  // Strapi v4: { data: [{ id, attributes: {...}}]}
  const a = row?.attributes ?? row ?? {};
  return {
    id: row?.id ?? a?.id ?? null,
    companyName: a?.companyName ?? null,
    isApproved: Boolean(a?.isApproved),
    discountPercent: typeof a?.discountPercent === "number" ? a.discountPercent : 0,
  };
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tf_token")?.value;

  if (!token) {
    return NextResponse.json(
      { loggedIn: false },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const baseUrl = strapiBaseUrl();

    // 1) Me
    const meRes = await fetch(`${baseUrl}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!meRes.ok) {
      return NextResponse.json(
        { loggedIn: false },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const me = await meRes.json();
    const user = pickSafeUser(me);

    // 2) Azienda collegata (se esiste)
    // Filtro: users_permissions_users contiene l’id utente
    // Nota: la sintassi filter potrebbe variare in base al nome relazione.
    // Qui uso quella tipica Strapi v4 per relazioni.
    let company: any = null;

    try {
      const url =
        `${baseUrl}${COMPANIES_PATH}` +
        `?filters[users_permissions_users][id][$eq]=${encodeURIComponent(String(user.id))}` +
        `&pagination[pageSize]=1`;

      const cRes = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (cRes.ok) {
        const payload = await cRes.json().catch(() => null);
        const first = Array.isArray(payload?.data) ? payload.data[0] : null;
        if (first) company = pickSafeCompany(first);
      }
    } catch {
      company = null;
    }

    return NextResponse.json(
      { loggedIn: true, user, company },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { loggedIn: false },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
