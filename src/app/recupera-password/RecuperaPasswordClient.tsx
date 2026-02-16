"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function safeNextPath(raw: string | null): string {
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

const GENERIC_MSG =
  "Se esiste un account associato a questa email, riceverai un messaggio con le istruzioni per reimpostare la password.";

export default function RecuperaPasswordClient() {
  const sp = useSearchParams();
  const nextParam = sp.get("next") ?? sp.get("redirect");
  const nextPath = useMemo(() => safeNextPath(nextParam), [nextParam]);

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setDoneMsg(null);

    const e1 = email.trim().toLowerCase();
    if (!e1 || !e1.includes("@")) {
      setErrorMsg("Inserisci un indirizzo email valido.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: e1 }),
        cache: "no-store",
      });

      // sicurezza: anche in caso di errore server mostriamo messaggio generico
      if (!res.ok) {
        setDoneMsg(GENERIC_MSG);
        return;
      }

      const json = await res.json().catch(() => null);
      setDoneMsg(typeof json?.message === "string" ? json.message : GENERIC_MSG);
    } catch {
      // fail-soft: non riveliamo dettagli
      setDoneMsg(GENERIC_MSG);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-background p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold">Recupera password</h1>
        <p className="mt-2 text-sm text-text/70">
          Inserisci la tua email. Se esiste un account, ti invieremo le istruzioni per reimpostare la password.
        </p>

        {errorMsg ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorMsg}
          </div>
        ) : null}

        {doneMsg ? (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {doneMsg}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <div>
            <label className="text-sm font-semibold text-text">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              className="mt-1 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder="es. mario@email.it"
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary text-primary-contrast text-sm font-extrabold hover:bg-primary-hover disabled:opacity-60"
          >
            {submitting ? "Invio in corso…" : "Invia link di recupero"}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <Link href={`/accedi?next=${encodeURIComponent(nextPath)}`} className="font-extrabold hover:underline">
            Torna ad Accedi
          </Link>

          <Link href={`/registrati?next=${encodeURIComponent(nextPath)}`} className="text-text/70 hover:underline">
            Crea un account
          </Link>
        </div>

        <div className="mt-6 text-xs text-text/60">
          Redirect dopo accesso: <span className="font-semibold">{nextPath}</span>
        </div>
      </div>
    </main>
  );
}
