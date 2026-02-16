"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const AUTH_EVENT = "tf:auth-changed";
const LOGIN_TIMEOUT_MS = 15_000;

function safeNextPath(raw: string | null): string {
  // ✅ Consenti SOLO path interni (anti open-redirect)
  if (!raw) return "/account";
  try {
    const decoded = decodeURIComponent(raw).trim();

    // blocca schemi/host, backslash, doppio slash, stringhe vuote
    if (!decoded.startsWith("/")) return "/account";
    if (decoded.startsWith("//")) return "/account";
    if (decoded.startsWith("/\\")) return "/account";
    if (decoded.includes("\n") || decoded.includes("\r")) return "/account";

    return decoded;
  } catch {
    return "/account";
  }
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, ms = LOGIN_TIMEOUT_MS) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

export default function AccediClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const nextParam = sp.get("next") ?? sp.get("redirect");
  const nextPath = useMemo(() => safeNextPath(nextParam), [nextParam]);

  const errorParam = sp.get("error");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    errorParam ? "Sessione non valida, accedi di nuovo." : null
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setError(null);

    const id = identifier.trim();
    const pw = String(password ?? "");

    if (!id || !pw) {
      setError("Inserisci email/username e password.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetchWithTimeout(
        "/api/auth/login",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ identifier: id, password: pw }),
          cache: "no-store",
        },
        LOGIN_TIMEOUT_MS
      );

      if (!res.ok) {
        // ✅ messaggio generico (anti-enumeration)
        setError("Credenziali non valide. Riprova.");
        return;
      }

      // ✅ Notifica Header (e altri componenti) che l'auth è cambiata
      try {
        window.dispatchEvent(new Event(AUTH_EVENT));
      } catch {
        // noop
      }

      router.replace(nextPath);
      router.refresh();
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setError("Connessione troppo lenta. Riprova tra pochi secondi.");
      } else {
        setError("Errore di rete. Riprova tra poco.");
      }
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
          <div
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="mt-6 space-y-3" noValidate>
          <div>
            <label className="text-sm font-semibold text-text" htmlFor="identifier">
              Email o username
            </label>
            <input
              id="identifier"
              name="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              inputMode="email"
              className="mt-1 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder="es. mario@email.it"
              disabled={submitting}
              aria-invalid={!!error}
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-text" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              type="password"
              className="mt-1 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder="••••••••"
              disabled={submitting}
              aria-invalid={!!error}
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
          <Link
            href={`/recupera-password?next=${encodeURIComponent(nextPath)}`}
            className="text-text/70 hover:underline"
          >
            Password dimenticata?
          </Link>

          <Link
            href={`/registrati?next=${encodeURIComponent(nextPath)}`}
            className="font-extrabold hover:underline"
          >
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
