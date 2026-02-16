"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pwMatch = useMemo(() => password.length > 0 && password === confirmPassword, [password, confirmPassword]);
  const pwOk = useMemo(() => password.length >= 8, [password]);
  const nameOk = useMemo(() => firstName.trim().length >= 2 && lastName.trim().length >= 2, [firstName, lastName]);

  const canSubmit = pwMatch && pwOk && email.trim().includes("@") && nameOk && !loading;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!canSubmit) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        credentials: "include",
        body: JSON.stringify({
          type: "PERSON",
          email,
          firstName,
          lastName,
          password,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.ok) {
        window.dispatchEvent(new Event("tf:auth-changed"));
        router.replace("/account");
        return;
      }

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

      setErrorMsg("Registrazione non riuscita. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-3xl font-extrabold">Registrati</h1>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input
            className="mt-1 w-full rounded-md border p-3"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            required
          />
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
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Password</label>
          <input
            className="mt-1 w-full rounded-md border p-3"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            required
          />
          {!pwOk && password.length > 0 ? (
            <p className="mt-1 text-sm text-red-600">Minimo 8 caratteri.</p>
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
          />
          {confirmPassword.length > 0 && !pwMatch ? (
            <p className="mt-1 text-sm text-red-600">Le password non coincidono.</p>
          ) : null}
        </div>

        {!nameOk && (firstName.length > 0 || lastName.length > 0) ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Inserisci nome e cognome (almeno 2 caratteri).
          </div>
        ) : null}

        {errorMsg ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{errorMsg}</div>
        ) : null}

        <button type="submit" disabled={!canSubmit} className="w-full rounded-full px-5 py-3 font-semibold disabled:opacity-50">
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
