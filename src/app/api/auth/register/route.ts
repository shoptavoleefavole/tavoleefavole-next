import { NextResponse } from "next/server";

export const runtime = "nodejs";

function strapiBaseUrl() {
  const raw =
    process.env.STRAPI_URL ||
    process.env.NEXT_PUBLIC_STRAPI_URL ||
    "http://localhost:1337";
  return raw.replace(/\/+$/, "");
}

const COMPANIES_PATH = process.env.STRAPI_COMPANIES_PATH || "/api/aziendes";

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type non valido" },
        { status: 415, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Body JSON non valido" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const type = body?.type === "BUSINESS" ? "BUSINESS" : "PERSON";
    const email = isNonEmptyString(body?.email) ? body.email.trim() : "";
    const username = isNonEmptyString(body?.username) ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Dati mancanti" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password troppo corta" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const firstName = isNonEmptyString(body?.firstName) ? body.firstName.trim() : undefined;
    const lastName = isNonEmptyString(body?.lastName) ? body.lastName.trim() : undefined;

    const companyName = isNonEmptyString(body?.companyName) ? body.companyName.trim() : undefined;
    const vatNumber = isNonEmptyString(body?.vatNumber) ? body.vatNumber.trim() : undefined;
    const sdi = isNonEmptyString(body?.sdi) ? body.sdi.trim() : undefined;
    const pec = isNonEmptyString(body?.pec) ? body.pec.trim() : undefined;
    const billingEmail = isNonEmptyString(body?.billingEmail) ? body.billingEmail.trim() : undefined;
    const billingAddress = isNonEmptyString(body?.billingAddress) ? body.billingAddress.trim() : undefined;

    if (type === "BUSINESS" && !companyName) {
      return NextResponse.json(
        { error: "Ragione sociale mancante" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const baseUrl = strapiBaseUrl();

    // 1) Register user
    const registerPayload: Record<string, any> = {
      email,
      username: username || email,
      password,
    };
    if (firstName) registerPayload.firstName = firstName;
    if (lastName) registerPayload.lastName = lastName;

    const res = await fetch(`${baseUrl}/api/auth/local/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(registerPayload),
    });

    const text = await res.text().catch(() => "");
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: "Registrazione non riuscita" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const jwt = data?.jwt as string | undefined;
    const userId = data?.user?.id as number | undefined;

    if (!jwt || !userId) {
      return NextResponse.json(
        { error: "Registrazione non riuscita" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 2) Se BUSINESS -> crea Azienda collegata all'utente
    if (type === "BUSINESS") {
      try {
        const companyPayload: any = {
          data: {
            companyName,
            vatNumber,
            sdi,
            pec,
            billingEmail,
            billingAddress,
            isApproved: false,
            discountPercent: 0,
            users_permissions_users: [userId], // ✅ collega utente
          },
        };

        await fetch(`${baseUrl}${COMPANIES_PATH}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`, // ✅ usa jwt appena creato
          },
          cache: "no-store",
          body: JSON.stringify(companyPayload),
        });
        // Se fallisce non blocchiamo login: l’admin può sistemare. (evita “rompere” registrazione)
      } catch {
        // noop
      }
    }

    // 3) Set cookie HttpOnly
    const response = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );

    response.cookies.set("tf_token", jwt, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
