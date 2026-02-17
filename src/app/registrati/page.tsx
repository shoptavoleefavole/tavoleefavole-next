"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const AUTH_EVENT = "tf:auth-changed";

// validazione email semplice ma più corretta di includes("@")
function isValidEmail(email: string) {
  const e = email.trim().toLowerCase();
  if (!e || e.length > 254) return false;
  if (/\s/.test(e)) return false;
  const at = e.indexOf("@");
  if (at <= 0 || at !== e.lastIndexOf("@")) return false;
  const domain = e.slice(at + 1);
  if (!domain || !domain.includes(".")) return false;
  if (domain.startsWith(".") || domain.endsWith(".")) return false;
  return true;
}

function clamp(v: string, max: number) {
  const s = (v ?? "").trim();
  return s.length > max ? s.slice(0, max) : s;
}

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const emailOk = useMemo(() => isValidEmail(email), [email]);

  const pwOk = useMemo(() => password.length >= 8 && password.length <= 200, [password]);
  const pwMatch = useMemo(
    () => password.length > 0 && password === confirmPassword,
    [password, confirmPassword]
  );

  const nameOk = useMemo(() => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    return fn.length >= 2 && ln.length >= 2 && fn.length <= 60 && ln.length <= 60;
  }, [firstName, lastName]);

  const canSubmit = emailOk && nameOk && pwOk && pwMatch && !loading;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return; // anti double-submit
    setErrorMsg(null);

    if (!canSubmit) {
      setErrorMsg("Controlla i campi e riprova.");
      return;
    }

    // normalizza lato client (no sorprese)
    const payload = {
      type: "PERSON" as const,
      email: clamp(email.toLowerCase(), 254),
      firstName: clamp(firstName, 60),
      lastName: clamp(lastName, 60),
      password: password, // non trimmiamo le password
    };

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        cache: "no-store",
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      // success
      if (res.ok && data?.ok) {
        // aggiorna header e stato auth
        window.dispatchEvent(new Event(AUTH_EVENT));

        // redirect a dashboard account
        router.replace("/account");
        return;
      }

      // messaggi controllati
      if (data?.error === "CHECK_EMAIL") {
        setErrorMsg(data?.message || "Controlla la tua email per recuperare l’accesso.");
        return;
      }
      if (data?.error === "WEAK_PASSWORD") {
        setErrorMsg("Password troppo debole (minimo 8 caratteri).");
        return;
      }
      if (data?.error === "INVALID_INPUT") {
        setErrorMsg("Dati non validi. Controlla email e riprova.");
        return;
      }

      // fallback generico
      setErrorMsg("Registrazione non riuscita. Riprova tra qualche secondo.");
    } catch {
      setErrorMsg("Errore di rete. Controlla la connessione e riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-3xl font-extrabold">Registrati</h1>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input
            className="mt-1 w-full rounded-md border p-3"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            required
            disabled={loading}
            inputMode="email"
          />
          {email.length > 0 && !emailOk ? (
            <p className="mt-1 text-sm text-red-600">Inserisci un’email valida.</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">Nome</label>
            <input
              className="mt-1 w-full rounded-md border p-3"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              required
              disabled={loading}
              maxLength={60}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Cognome</label>
            <input
              className="mt-1 w-full rounded-md border p-3"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              required
              disabled={loading}
              maxLength={60}
            />
          </div>
        </div>

        {!nameOk && (firstName.length > 0 || lastName.length > 0) ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Inserisci nome e cognome (almeno 2 caratteri).
          </div>
        ) : null}

        <div>
          <label className="block text-sm font-medium">Password</label>
          <input
            className="mt-1 w-full rounded-md border p-3"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            required
            disabled={loading}
            minLength={8}
            maxLength={200}
          />
          {!pwOk && password.length > 0 ? (
            <p className="mt-1 text-sm text-red-600">Minimo 8 caratteri (massimo 200).</p>
          ) : null}
        </div>

        <div>
          <label className="block text-sm font-medium">Conferma password</label>
          <input
            className="mt-1 w-full rounded-md border p-3"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            required
            disabled={loading}
            minLength={8}
            maxLength={200}
          />
          {confirmPassword.length > 0 && !pwMatch ? (
            <p className="mt-1 text-sm text-red-600">Le password non coincidono.</p>
          ) : null}
        </div>

        {errorMsg ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {errorMsg}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-full px-5 py-3 font-semibold disabled:opacity-50"
        >
          {loading ? "Creazione..." : "Crea account"}
        </button>

        <div className="flex items-center justify-between text-sm">
          <span>Hai già un account?</span>
          <Link href="/accedi" className="font-semibold underline">
            Accedi
          </Link>
        </div>
      </form>
    </div>
  );
}
