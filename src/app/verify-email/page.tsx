// src/app/verify-email/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type VerifyResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
  alreadyVerified?: boolean;
};

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifica in corso...");
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const token = params.get("token");

      if (!token) {
        if (cancelled) return;
        setStatus("error");
        setMessage("Token mancante.");
        return;
      }

      try {
        const res = await fetch("/api/auth/verify-user", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          cache: "no-store",
          body: JSON.stringify({ token }),
        });

        const data = (await res.json().catch(() => null)) as VerifyResponse | null;
        if (cancelled) return;

        if (res.ok && data?.ok) {
          setStatus("success");
          setMessage(data.message || "Email verificata! Reindirizzamento...");
          window.setTimeout(() => {
            router.push("/account");
          }, 1800);
          return;
        }

        setStatus("error");
        setMessage(
          data?.message ||
            (res.status === 400
              ? "Token non valido o scaduto."
              : "Impossibile completare la verifica email.")
        );
      } catch {
        if (cancelled) return;
        setStatus("error");
        setMessage("Errore di rete durante la verifica email.");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {status === "loading" && <div>Verifica in corso...</div>}

        {status === "success" && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-2xl text-green-600">✓</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{message}</h1>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-2xl text-red-600">✕</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Verifica fallita</h1>
            <p className="text-gray-600">{message}</p>
            <a
              href="/registrati"
              className="block w-full bg-primary text-white py-3 px-6 rounded-xl font-bold hover:bg-primary/90"
            >
              Riprova registrazione
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
