import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // 1) Body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Body JSON non valido" }, { status: 400 });
    }

    const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!identifier || !password) {
      return NextResponse.json({ error: "Missing identifier or password" }, { status: 400 });
    }

    // 2) Strapi base url
    const rawBaseUrl =
      process.env.STRAPI_URL ||
      process.env.NEXT_PUBLIC_STRAPI_URL ||
      "http://localhost:1337";

    const baseUrl = rawBaseUrl.replace(/\/+$/, "");

    // 3) Login su Strapi
    const res = await fetch(`${baseUrl}/api/auth/local`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
      cache: "no-store",
    });

    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.message || "Login failed", details: data?.error ?? data },
        { status: res.status }
      );
    }

    const jwt = data?.jwt as string | undefined;
    if (!jwt) {
      return NextResponse.json({ error: "Missing jwt in response" }, { status: 500 });
    }

    // 4) Risposta + cookie (✅ modo giusto)
    const response = NextResponse.json(
      { ok: true, user: data.user },
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
  } catch (e: any) {
    return NextResponse.json(
      { error: "Server error", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}
