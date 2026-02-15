"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type AccountType = "PERSON" | "BUSINESS";

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

export default function RegistratiClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const nextParam = sp.get("next") ?? sp.get("redirect");
  const nextPath = useMemo(() => safeNextPath(nextParam), [nextParam]);

  const [type, setType] = useState<AccountType>("PERSON");

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // campi profilo
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // campi azienda (facoltativi se PERSON)
  const [companyName, setCompanyName] = useState("");
  const [vat, setVat] = useState(""); // P.IVA
  const [sdi, setSdi] = useState(""); // SDI
  const [pec, setPec] = useState(""); // PEC

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const e1 = email.trim();
    const u1 = username.trim();
    if (!e1 || !password) {
      setError("Inserisci email e password.");
      return;
    }

    if (type === "BUSINESS" && !companyName.trim()) {
      setError("Inserisci la ragione sociale.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          type,
          email: e1,
          username: u1 || e1,
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          companyName: companyName.trim(),
          vat: vat.trim(),
          sdi: sdi.trim(),
          pec: pec.trim(),
        }),
        cache: "no-store",
      });

      if (!res.ok) {
        setError("Registrazione non riuscita. Controlla i dati e riprova.");
        return;
      }

      // ✅ dopo registrazione facciamo login automatico (cookie HttpOnly) e redirect
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
        <h1 className="text-2xl font-extrabold">Registrati</h1>
        <p className="mt-2 text-sm text-text/70">
          Crea un account. Se sei un’azienda puoi richiedere un profilo business per sconti dedicati.
        </p>

        {/* Tipo account */}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setType("PERSON")}
            className={`h-10 rounded-xl border px-3 text-sm font-extrabold ${
              type === "PERSON" ? "border-primary bg-primary text-primary-contrast" : "border-border bg-white hover:bg-surface"
            }`}
          >
            Privato
          </button>
          <button
            type="button"
            onClick={() => setType("BUSINESS")}
            className={`h-10 rounded-xl border px-3 text-sm font-extrabold ${
              type === "BUSINESS" ? "border-primary bg-primary text-primary-contrast" : "border-border bg-white hover:bg-surface"
            }`}
          >
            Azienda
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
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
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-text">Username (opzionale)</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="mt-1 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder="es. mario.rossi"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-semibold text-text">Nome</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-text">Cognome</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {type === "BUSINESS" ? (
            <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
              <div className="text-sm font-extrabold">Dati aziendali</div>

              <div>
                <label className="text-sm font-semibold text-text">Ragione sociale *</label>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-semibold text-text">P.IVA</label>
                  <input
                    value={vat}
                    onChange={(e) => setVat(e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-text">SDI</label>
                  <input
                    value={sdi}
                    onChange={(e) => setSdi(e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-text">PEC</label>
                <input
                  value={pec}
                  onChange={(e) => setPec(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                  placeholder="es. pec@azienda.it"
                />
              </div>

              <div className="text-xs text-text/60">
                Nota: per attivare sconti business potremmo richiedere una verifica.
              </div>
            </div>
          ) : null}

          <div>
            <label className="text-sm font-semibold text-text">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
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
            {submitting ? "Creazione account…" : "Crea account"}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-text/70">Hai già un account?</span>
          <Link href={`/accedi?next=${encodeURIComponent(nextPath)}`} className="font-extrabold hover:underline">
            Accedi
          </Link>
        </div>

        <div className="mt-6 text-xs text-text/60">
          Redirect dopo registrazione: <span className="font-semibold">{nextPath}</span>
        </div>
      </div>
    </main>
  );
}
