"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const AUTH_EVENT = "tf:auth-changed";

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
  const s = String(v ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > max ? s.slice(0, max) : s;
}

// Validazione semplice P.IVA IT: 11 cifre
function isValidVatIT(v: string) {
  const s = v.replace(/\s+/g, "").trim();
  return /^\d{11}$/.test(s);
}

// SDI: spesso 7 char (alfa-num) oppure "0000000" / "XXXXXXX"
function isValidSdi(v: string) {
  const s = v.replace(/\s+/g, "").trim().toUpperCase();
  return /^[A-Z0-9]{7}$/.test(s);
}

export default function RegisterBusinessPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const next = useMemo(() => {
    const n = sp.get("next");
    return n ? n : "/account";
  }, [sp]);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState(""); // referente
  const [lastName, setLastName] = useState("");  // referente
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [pec, setPec] = useState("");
  const [sdi, setSdi] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const emailOk = useMemo(() => isValidEmail(email), [email]);
  const pecOk = useMemo(() => isValidEmail(pec), [pec]);

  const pwOk = useMemo(() => password.length >= 8 && password.length <= 200, [password]);
  const pwMatch = useMemo(() => password.length > 0 && password === confirmPassword, [password, confirmPassword]);

  const nameOk = useMemo(() => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    return fn.length >= 2 && ln.length >= 2 && fn.length <= 60 && ln.length <= 60;
  }, [firstName, lastName]);

  const companyOk = useMemo(() => clamp(companyName, 140).length >= 2, [companyName]);
  const vatOk = useMemo(() => isValidVatIT(vatNumber), [vatNumber]);
  const sdiOk = useMemo(() => isValidSdi(sdi), [sdi]);

  const canSubmit =
    emailOk && nameOk && pwOk && pwMatch && companyOk && vatOk && pecOk && sdiOk && !loading;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setErrorMsg(null);

    if (!canSubmit) {
      setErrorMsg("Controlla i campi e riprova.");
      return;
    }

    const payload = {
      type: "BUSINESS" as const,
      email: clamp(email.toLowerCase(), 254),
      firstName: clamp(firstName, 60),
      lastName: clamp(lastName, 60),
      password,

      companyName: clamp(companyName, 140),
      vatNumber: clamp(vatNumber.replace(/\s+/g, ""), 40),
      pec: clamp(pec.toLowerCase(), 254),
      sdi: clamp(sdi.toUpperCase().replace(/\s+/g, ""), 20),
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

      if (res.ok && data?.ok) {
        window.dispatchEvent(new Event(AUTH_EVENT));
        router.replace(next);
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
      if (data?.error === "MISSING_COMPANY") {
        setErrorMsg("Inserisci la ragione sociale.");
        return;
      }
      if (data?.error === "INVALID_INPUT") {
        setErrorMsg("Dati non validi. Controlla email e riprova.");
        return;
      }

      setErrorMsg("Registrazione non riuscita. Riprova tra qualche secondo.");
    } catch {
      setErrorMsg("Errore di rete. Controlla la connessione e riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="rounded-3xl border border-border bg-background p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold">Registrati Azienda</h1>
            <p className="mt-2 text-sm text-text/70">
              Tutti i campi aziendali sono obbligatori (Ragione sociale, P.IVA, PEC, SDI).
            </p>
          </div>
          <Link href="/registrati" className="text-sm font-extrabold underline">
            Indietro
          </Link>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          {/* Email account */}
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
            {email.length > 0 && !emailOk ? <p className="mt-1 text-sm text-red-600">Email non valida.</p> : null}
          </div>

          {/* Referente */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium">Nome referente</label>
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
              <label className="block text-sm font-medium">Cognome referente</label>
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

          {/* Dati Azienda */}
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="text-sm font-extrabold">Dati Azienda</div>

            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-sm font-medium">Ragione sociale</label>
                <input
                  className="mt-1 w-full rounded-md border p-3"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  disabled={loading}
                  maxLength={140}
                />
                {companyName.length > 0 && !companyOk ? (
                  <p className="mt-1 text-sm text-red-600">Inserisci la ragione sociale.</p>
                ) : null}
              </div>

              <div>
                <label className="block text-sm font-medium">Partita IVA (11 cifre)</label>
                <input
                  className="mt-1 w-full rounded-md border p-3"
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  required
                  disabled={loading}
                  inputMode="numeric"
                />
                {vatNumber.length > 0 && !vatOk ? (
                  <p className="mt-1 text-sm text-red-600">P.IVA non valida (serve 11 cifre).</p>
                ) : null}
              </div>

              <div>
                <label className="block text-sm font-medium">PEC</label>
                <input
                  className="mt-1 w-full rounded-md border p-3"
                  value={pec}
                  onChange={(e) => setPec(e.target.value)}
                  required
                  disabled={loading}
                  inputMode="email"
                />
                {pec.length > 0 && !pecOk ? <p className="mt-1 text-sm text-red-600">PEC non valida.</p> : null}
              </div>

              <div>
                <label className="block text-sm font-medium">Codice SDI (7 caratteri)</label>
                <input
                  className="mt-1 w-full rounded-md border p-3 uppercase"
                  value={sdi}
                  onChange={(e) => setSdi(e.target.value)}
                  required
                  disabled={loading}
                  maxLength={7}
                />
                {sdi.length > 0 && !sdiOk ? (
                  <p className="mt-1 text-sm text-red-600">SDI non valido (7 caratteri alfanumerici).</p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Password */}
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
            {!pwOk && password.length > 0 ? <p className="mt-1 text-sm text-red-600">Minimo 8 caratteri.</p> : null}
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
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{errorMsg}</div>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-full px-5 py-3 font-semibold disabled:opacity-50"
          >
            {loading ? "Creazione..." : "Crea account azienda"}
          </button>

          <div className="flex items-center justify-between text-sm">
            <span>Hai già un account?</span>
            <Link href="/accedi" className="font-semibold underline">
              Accedi
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
