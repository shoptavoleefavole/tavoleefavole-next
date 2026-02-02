import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const username = body?.username;
    const email = body?.email;
    const password = body?.password;

    if (!username || !email || !password) {
      return NextResponse.json(
        { error: "Missing username, email or password" },
        { status: 400 }
      );
    }

    const baseUrlRaw =
      process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL;

    if (!baseUrlRaw) {
      return NextResponse.json(
        { error: "Missing STRAPI_URL env var" },
        { status: 500 }
      );
    }

    // evita doppio slash
    const baseUrl = baseUrlRaw.replace(/\/+$/, "");

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/auth/local/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
        cache: "no-store",
      });
    } catch (fetchErr: any) {
      // caso tipico: Strapi non raggiungibile / DNS / porta
      return NextResponse.json(
        {
          error: "Cannot reach Strapi",
          details: fetchErr?.message || String(fetchErr),
          strapiUrl: baseUrl,
        },
        { status: 502 }
      );
    }

    // Leggiamo prima come testo: se non è JSON non crasha
    const rawText = await res.text();
    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          error: data?.error?.message || "Register failed",
          status: res.status,
          strapiResponse: data ?? rawText,
        },
        { status: res.status }
      );
    }

    const jwt = data?.jwt as string | undefined;
    if (!jwt) {
      return NextResponse.json(
        {
          error: "Missing jwt in response",
          strapiResponse: data ?? rawText,
        },
        { status: 500 }
      );
    }

    const response = NextResponse.json({ ok: true, user: data.user });

    response.cookies.set("tf_token", jwt, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (e: any) {
    return NextResponse.json(
      { error: "Server error", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}
