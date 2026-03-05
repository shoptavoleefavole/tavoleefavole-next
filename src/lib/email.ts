'use server';

import { Resend } from 'resend';
import { SignJWT, jwtVerify } from 'jose';

const resend = new Resend(process.env.RESEND_API_KEY!);
const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function sendVerificationEmail(email: string) {
  const token = await new SignJWT({ email, type: 'verify' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .setIssuedAt()
    .sign(secret);

  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: email,
    subject: 'Verifica Email - Tavole e Favole',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #8b5cf6;">Benvenuto! Verifica la tua email</h1>
        <p>Clicca il link per attivare il tuo account:</p>
        <a href="${process.env.SITE_URL}/verify-email?token=${token}" 
           style="display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; border-radius: 9999px; text-decoration: none; font-weight: 600;">
          Verifica Email
        </a>
        <p style="font-size: 14px; color: #6b7280; margin-top: 24px;">
          Token valido per 1 ora. Se non hai creato un account, ignora questa email.
        </p>
      </div>`
  });

  return !error;
}

export async function verifyEmailToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.email as string;
  } catch {
    return null;
  }
}
