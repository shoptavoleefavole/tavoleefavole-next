// src/lib/email.ts
import { Resend } from "resend";
import { SignJWT, jwtVerify } from "jose";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const JWT_SECRET = process.env.JWT_SECRET ?? "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
const secret = JWT_SECRET ? new TextEncoder().encode(JWT_SECRET) : null;

const emailAttempts = new Map<string, number>();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_PER_EMAIL = 3;

function getSiteUrl() {
  const raw = (
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    ""
  ).trim();

  if (!raw) return "";

  try {
    const url = new URL(raw);
    return url.toString().replace(/\/+$/, "");
  } catch {
    const normalized = raw.replace(/\/+$/, "");
    if (/^https?:\/\//i.test(normalized)) return normalized;
    return `https://${normalized}`;
  }
}

function checkEmailRateLimit(email: string): boolean {
  const now = Date.now();
  const key = `verify:${email.toLowerCase()}`;

  if (emailAttempts.size > 1000) {
    for (const k of emailAttempts.keys()) {
      if (now - (emailAttempts.get(k) || 0) > RATE_WINDOW_MS) {
        emailAttempts.delete(k);
      }
    }
  }

  const lastSent = emailAttempts.get(key);
  if (lastSent && now - lastSent < RATE_WINDOW_MS) {
    return false;
  }

  if (emailAttempts.size > RATE_MAX_PER_EMAIL * 10) {
    return false;
  }

  emailAttempts.set(key, now);
  return true;
}

function isValidEmail(email: string) {
  const clean = String(email ?? "").trim().toLowerCase();
  if (!clean || clean.length < 6 || clean.length > 254) return false;
  if (!clean.includes("@")) return false;
  if (/\s/.test(clean)) return false;
  return true;
}

export async function sendVerificationEmail(email: string): Promise<boolean> {
  const cleanEmail = String(email ?? "").trim().toLowerCase();
  const siteUrl = getSiteUrl();

  if (!isValidEmail(cleanEmail)) {
    console.error("[email] Invalid email format:", email);
    return false;
  }

  if (!checkEmailRateLimit(cleanEmail)) {
    console.warn("[email] Rate limit exceeded for:", cleanEmail);
    return false;
  }

  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL || !siteUrl || !resend) {
    console.error("[email] Missing email configuration", {
      hasApiKey: !!RESEND_API_KEY,
      hasFrom: !!RESEND_FROM_EMAIL,
      hasSiteUrl: !!siteUrl,
    });
    return false;
  }

  if (!secret) {
    console.error("[email] Missing JWT_SECRET configuration");
    return false;
  }

  try {
    const token = await new SignJWT({
      email: cleanEmail,
      type: "verify-email",
      iss: "tavoleefavole",
      aud: "verify",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .setIssuedAt()
      .setJti(Math.random().toString(36).slice(2))
      .sign(secret);

    const verifyUrl = `${siteUrl}/verify-email?token=${encodeURIComponent(token)}`;

    const { error } = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: cleanEmail,
      subject: "✅ Verifica Email - Tavole e Favole",
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
</head>
<body style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,'Open Sans','Helvetica Neue',sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; line-height: 1.6; color: #374151;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="color: #8b5cf6; font-size: 28px; font-weight: 700; margin: 0 0 16px 0;">Benvenuto!</h1>
    <p style="color: #6b7280; font-size: 16px; margin: 0;">Verifica la tua email per attivare l'account</p>
  </div>

  <div style="background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%); border-radius: 16px; padding: 0; text-align: center; box-shadow: 0 20px 25px -5px rgba(139, 92, 246, 0.3);">
    <a href="${verifyUrl}"
       style="display: inline-block; background: transparent; color: white; padding: 16px 32px; border-radius: 16px; text-decoration: none; font-weight: 700; font-size: 16px; border: 2px solid rgba(255,255,255,0.2); transition: all 0.2s; min-width: 200px;">
      Verifica Email
    </a>
  </div>

  <div style="margin-top: 32px; padding: 24px; background: #f9fafb; border-radius: 12px; border-left: 4px solid #8b5cf6;">
    <p style="font-size: 14px; color: #6b7280; margin: 0 0 8px 0; font-weight: 500;">
      🔐 Token sicuro - 1 ora di validità
    </p>
    <p style="font-size: 14px; color: #9ca3af; margin: 0;">
      Se non hai creato un account su Tavole e Favole, ignora questo messaggio.
    </p>
  </div>

  <hr style="margin: 40px 0; border: none; border-top: 1px solid #e5e7eb;">
  <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
    © 2026 Tavole e Favole. Tutti i diritti riservati.
  </p>
</body>
</html>`,
      text: `Verifica il tuo account Tavole e Favole:
${verifyUrl}

Token valido per 1 ora.`,
    });

    if (error) {
      console.error("[email] Resend error:", error);
      return false;
    }

    console.log(`[email] Verification sent to: ${cleanEmail}`);
    return true;
  } catch (error) {
    console.error("[email] sendVerificationEmail error:", error);
    return false;
  }
}

export async function verifyEmailToken(token: string): Promise<string | null> {
  if (!secret) {
    console.error("[email] Missing JWT_SECRET configuration in verifyEmailToken");
    return null;
  }

  if (!token || typeof token !== "string" || token.length < 10) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: "tavoleefavole",
      audience: "verify",
    });

    if (
      typeof payload.email !== "string" ||
      payload.type !== "verify-email" ||
      !payload.iss ||
      payload.iss !== "tavoleefavole"
    ) {
      return null;
    }

    if ((payload.exp || 0) * 1000 < Date.now()) {
      return null;
    }

    return payload.email.trim().toLowerCase();
  } catch (error) {
    console.warn("[email] verifyEmailToken invalid:", error);
    return null;
  }
}
