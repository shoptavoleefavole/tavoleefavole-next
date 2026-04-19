// src/app/api/auth/verify-user/route.ts
import { NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRAPI_SERVICE_TOKEN =
  process.env.STRAPI_API_TOKEN || process.env.STRAPI_TOKEN || "";

function json(data: any, status = 200) {
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

async function fetchJson(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const text = await res.text().catch(() => "");
  return { res, json: safeJsonParse(text), text };
}

function serviceHeaders() {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}`,
  };
}

function extractUserArray(json: any): any[] {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  return [];
}

function normalizeEmail(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

async function findUserByEmail(base: string, email: string) {
  const encoded = encodeURIComponent(email);

  const urls = [
    `${base}/api/users?filters[email][$eq]=${encoded}&pagination[pageSize]=1`,
    `${base}/api/users?email=${encoded}`,
    `${base}/api/users?pagination[pageSize]=100`,
  ];

  for (const url of urls) {
    const result = await fetchJson(url, {
      method: "GET",
      headers: serviceHeaders(),
    });

    if (!result.res.ok) continue;

    const users = extractUserArray(result.json);
    const match =
      users.find((u: any) => normalizeEmail(u?.email) === email) ||
      users[0] ||
      null;

    if (match?.id) return match;
  }

  return null;
}

async function confirmUser(base: string, userId: number) {
  const payloads = [
    { confirmed: true },
    { confirmed: true, confirmationToken: null },
  ];

  let lastStatus = 0;
  let lastText = "";

  for (const body of payloads) {
    const result = await fetchJson(`${base}/api/users/${userId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...serviceHeaders(),
      },
      body: JSON.stringify(body),
    });

    lastStatus = result.res.status;
    lastText = result.text;

    if (result.res.ok) return { ok: true as const };
  }

  return { ok: false as const, status: lastStatus, text: lastText };
}

export async function POST(req: Request) {
  if (!STRAPI_SERVICE_TOKEN) {
    return json(
      { ok: false, error: "SERVER_MISCONFIG", message: "Service token Strapi mancante." },
      500
    );
  }

  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return json({ ok: false, error: "UNSUPPORTED_CONTENT_TYPE" }, 415);
  }

  const body = await req.json().catch(() => null);
  const token = String(body?.token ?? "");

  if (!token) {
    return json({ ok: false, error: "TOKEN_REQUIRED", message: "Token mancante." }, 400);
  }

  const email = await verifyEmailToken(token);
  if (!email) {
    return json(
      { ok: false, error: "INVALID_OR_EXPIRED_TOKEN", message: "Token non valido o scaduto." },
      400
    );
  }

  const base = strapiBaseUrl();
  const user = await findUserByEmail(base, email);

  if (!user?.id) {
    return json(
      { ok: false, error: "USER_NOT_FOUND", message: "Utente non trovato per questo token." },
      404
    );
  }

  if (user.confirmed === true) {
    return json({
      ok: true,
      alreadyVerified: true,
      message: "Email già verificata. Reindirizzamento...",
    });
  }

  const confirmed = await confirmUser(base, Number(user.id));
  if (!confirmed.ok) {
    return json(
      {
        ok: false,
        error: "CONFIRM_FAILED",
        message: "Impossibile attivare l'utente.",
      },
      502
    );
  }

  return json({
    ok: true,
    message: "Email verificata! Reindirizzamento...",
  });
}
