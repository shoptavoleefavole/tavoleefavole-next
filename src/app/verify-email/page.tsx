'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { verifyEmailToken } from '@/lib/email';

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Token mancante');
      return;
    }

    verifyEmailToken(token)
      .then((email) => {
        if (email) {
          // Chiama API per attivare utente
          fetch('/api/auth/verify-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
          }).then(res => {
            if (res.ok) {
              setStatus('success');
              setMessage('Email verificata! Reindirizzamento...');
              setTimeout(() => router.push('/account'), 2000);
            } else {
              setStatus('error');
              setMessage('Token scaduto o già usato');
            }
          });
        } else {
          setStatus('error');
          setMessage('Token non valido');
        }
      });
  }, [params, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {status === 'loading' && <div>Verifica in corso...</div>}
        {status === 'success' && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-2xl text-green-600">✓</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{message}</h1>
          </div>
        )}
        {status === 'error' && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-2xl text-red-600">✕</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Verifica fallita</h1>
            <p className="text-gray-600">{message}</p>
            <a href="/registrati" className="block w-full bg-primary text-white py-3 px-6 rounded-xl font-bold hover:bg-primary/90">
              Riprova registrazione
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
