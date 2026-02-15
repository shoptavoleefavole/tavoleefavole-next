"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function safeNextPath(raw: string | null): string {
  // Sicurezza: accettiamo SOLO path interni (evita open-redirect tipo https://evil.com)
  if (!raw) return "/account";
  try {
    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith("/")) return "/account";
    if (decoded.startsWith("//")) return "/account";
    return decoded;
  } catch {
    return "/account";
  }
}

export default function AccediClient() {
  const sp = useSearchParams();
  const router = useRouter();

  // supportiamo sia ?next= che ?redirect= per compatibilità
  const nextParam = sp.get("next") ?? sp.get("redirect");
  const nextPath = useMemo(() => safeNextPath(nextParam), [nextParam]);

  const errorParam = sp.get("error");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(errorParam ? "Sessione non valida, accedi di nuovo." : null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const id = identifier.trim();
    if (!id || !password) {
      setError("Inserisci email/username e password.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ identifier: id, password }),
        cache: "no-store",
      });

      if (!res.ok) {
        // Sicurezza: messaggio generico (non rivelare se email esiste)
        setError("Credenziali non valide. Riprova.");
        return;
      }

      // ✅ cookie HttpOnly settato dal server: ora possiamo navigare
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova tra poco.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-background p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold">Accedi</h1>
        <p className="mt-2 text-sm text-text/70">
          Accedi per vedere il tuo profilo, ordini, preferiti e offerte riservate.
        </p>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <div>
            <label className="text-sm font-semibold text-text">Email o username</label>
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              inputMode="email"
              className="mt-1 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder="es. mario@email.it"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-text">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              type="password"
              className="mt-1 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary text-primary-contrast text-sm font-extrabold hover:bg-primary-hover disabled:opacity-60"
          >
            {submitting ? "Accesso in corso…" : "Accedi"}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <Link href={`/accedi?next=${encodeURIComponent(nextPath)}`} className="text-text/70 hover:underline">
            Hai problemi di accesso?
          </Link>

          {/* Se /registrati non esiste ancora, non rompe il login: è solo un link.
              Se vuoi, dopo ti preparo anche la pagina registrazione con route sicura. */}
          <Link href={`/registrati?next=${encodeURIComponent(nextPath)}`} className="font-extrabold hover:underline">
            Registrati
          </Link>
        </div>

        <div className="mt-6 text-xs text-text/60">
          Redirect dopo accesso: <span className="font-semibold">{nextPath}</span>
        </div>
      </div>
    </main>
  );
}
