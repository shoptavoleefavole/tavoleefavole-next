import { NextResponse } from "next/server";

export const runtime = "nodejs";

function strapiBaseUrl() {
  const raw =
    process.env.STRAPI_URL ||
    process.env.NEXT_PUBLIC_STRAPI_URL ||
    "http://localhost:1337";
  return raw.replace(/\/+$/, "");
}

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return NextResponse.json({ error: "Content-Type non valido" }, { status: 415, headers: { "Cache-Control": "no-store" } });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Body JSON non valido" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!identifier || !password) {
      return NextResponse.json({ error: "Dati mancanti" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    const baseUrl = strapiBaseUrl();

    const res = await fetch(`${baseUrl}/api/auth/local`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
      cache: "no-store",
    });

    const text = await res.text().catch(() => "");
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      // Sicurezza: messaggio generico, non leakare dettagli Strapi
      const status = res.status >= 400 && res.status <= 499 ? 401 : 500;
      return NextResponse.json(
        { error: "Credenziali non valide" },
        { status, headers: { "Cache-Control": "no-store" } }
      );
    }

    const jwt = data?.jwt as string | undefined;
    if (!jwt) {
      return NextResponse.json({ error: "Login non riuscito" }, { status: 500, headers: { "Cache-Control": "no-store" } });
    }

    const response = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );

    response.cookies.set("tf_token", jwt, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 giorni
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
