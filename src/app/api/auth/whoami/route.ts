import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tf_token")?.value;

  const baseUrl = (process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337").replace(
    /\/+$/,
    ""
  );

  if (!token) {
    return NextResponse.json(
      { loggedIn: false, user: null, role: null, isAdmin: false, strapiBaseUrl: baseUrl },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const r = await fetch(`${baseUrl}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  let data: any = null;
  try {
    data = await r.json();
  } catch {
    data = null;
  }

  if (!r.ok || !data?.email) {
    return NextResponse.json(
      {
        loggedIn: false,
        user: null,
        role: null,
        isAdmin: false,
        strapiBaseUrl: baseUrl,
        strapiStatus: r.status,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const email = String(data.email).toLowerCase();
  const isAdmin = getAdminEmails().includes(email);

  return NextResponse.json(
    {
      loggedIn: true,
      user: data,
      role: null, // nel tuo setup Strapi non lo espone
      isAdmin,
      strapiBaseUrl: baseUrl,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
