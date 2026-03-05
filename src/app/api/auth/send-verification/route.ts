import { NextRequest, NextResponse } from 'next/server';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email mancante' }, { status: 400 });
    }

    const sent = await sendVerificationEmail(email);
    return sent 
      ? NextResponse.json({ ok: true, message: 'Email inviata!' })
      : NextResponse.json({ error: 'Errore invio email' }, { status: 500 });
  } catch (error) {
    console.error('[send-verification] error:', error);
    return NextResponse.json({ error: 'Errore server' }, { status: 500 });
  }
}
