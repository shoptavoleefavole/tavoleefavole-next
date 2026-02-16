import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function strapiBaseUrl() {
  const raw = process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";
  return raw.replace(/\/+$/, "");
}

function safeJsonParse(text: string) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function jsonNoStore(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function normalizeEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

/**
 * Messaggio anti-enumeration: non conferma mai se l'account esiste.
 */
const GENERIC_RECOVERY_MSG =
  "Se esiste un account associato a questa email, riceverai un messaggio con le istruzioni per reimpostare la password.";

async function strapiPost(path: string, body: any) {
  const base = strapiBaseUrl();
  const url = `${base}${path}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  const data = safeJsonParse(text);
  return { res, data, text };
}

export async function POST(req: Request) {
  try {
    const raw = await req.text().catch(() => "");
    const body = safeJsonParse(raw);

    const email = normalizeEmail(body?.email);

    // Anche se input è invalido, rispondiamo generico (anti-enumeration)
    if (!email || !email.includes("@")) {
      return jsonNoStore({ ok: true, message: GENERIC_RECOVERY_MSG }, 200);
    }

    // Best-effort: se Strapi/email provider non funziona, non blocchiamo e non riveliamo dettagli
    try {
      await strapiPost("/api/auth/forgot-password", { email });
    } catch {
      // ignore
    }

    return jsonNoStore({ ok: true, message: GENERIC_RECOVERY_MSG }, 200);
  } catch {
    // fail-soft: sempre generico
    return jsonNoStore({ ok: true, message: GENERIC_RECOVERY_MSG }, 200);
  }
}
