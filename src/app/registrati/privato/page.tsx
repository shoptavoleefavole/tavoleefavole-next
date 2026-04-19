// src/app/registrati/privato/page.tsx

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  const s = (v ?? "").trim();
  return s.length > max ? s.slice(0, max) : s;
}

type Address = {
  address: string;
  city: string;
  postalCode: string;
  province: string;
  country: string;
};

function capOk(cap: string) {
  const c = String(cap || "").replace(/\s+/g, "");
  return /^\d{5}$/.test(c);
}

function normalizeAddr(a: Address): Address {
  return {
    address: a.address.trim(),
    city: a.city.trim(),
    postalCode: a.postalCode.trim().replace(/\s+/g, ""),
    province: a.province.trim(),
    country: "IT",
  };
}

function validateAddr(a: Address): string | null {
  if (a.address.trim().length < 3) return "Inserisci un indirizzo valido.";
  if (a.city.trim().length < 2) return "Inserisci una città valida.";
  if (!capOk(a.postalCode)) return "Inserisci un CAP valido (5 cifre).";
  if (a.province.trim().length < 2) return "Inserisci una provincia valida.";
  return null;
}

export const dynamic = "force-dynamic";

export default function RegisterPrivatePage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [shippingAddress, setShippingAddress] = useState<Address>({
    address: "",
    city: "",
    postalCode: "",
    province: "",
    country: "IT",
  });

  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [billingAddress, setBillingAddress] = useState<Address>({
    address: "",
    city: "",
    postalCode: "",
    province: "",
    country: "IT",
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const emailOk = useMemo(() => isValidEmail(email), [email]);
  const pwOk = useMemo(() => password.length >= 8 && password.length <= 200, [password]);
  const pwMatch = useMemo(() => password.length > 0 && password === confirmPassword, [password, confirmPassword]);

  const nameOk = useMemo(() => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    return fn.length >= 2 && ln.length >= 2 && fn.length <= 60 && ln.length <= 60;
  }, [firstName, lastName]);

  const shipErr = useMemo(() => validateAddr(shippingAddress), [shippingAddress]);
  const billErr = useMemo(
    () => (billingSameAsShipping ? null : validateAddr(billingAddress)),
    [billingSameAsShipping, billingAddress]
  );

  const canSubmit = emailOk && nameOk && pwOk && pwMatch && !shipErr && !billErr && !loading;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setErrorMsg(null);

    if (!canSubmit) {
      setErrorMsg("Controlla i campi e riprova.");
      return;
    }

    const payload = {
      type: "PERSON" as const,
      email: clamp(email.toLowerCase(), 254),
      firstName: clamp(firstName, 60),
      lastName: clamp(lastName, 60),
      password,
      shippingAddress: normalizeAddr(shippingAddress),
      billingSameAsShipping,
      billingAddress: billingSameAsShipping ? undefined : normalizeAddr(billingAddress),
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

      if (res.ok && data?.ok && data?.profileCreated !== false) {
        window.dispatchEvent(new Event(AUTH_EVENT));
        router.replace("/account");
        return;
      }

      if (data?.error === "PROFILE_SETUP_FAILED" || data?.profileCreated === false) {
        setErrorMsg(
          data?.message ||
            "Account creato, ma il profilo non è stato inizializzato correttamente. Accedi e completa i dati."
        );
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
      if (String(data?.error || "").startsWith("SHIPPING_") || String(data?.error || "").startsWith("BILLING_")) {
        setErrorMsg("Indirizzo non valido. Controlla spedizione/fatturazione e riprova.");
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
      <div className="mb-4">
        <Link href="/registrati" className="text-sm font-semibold underline">
          ← Torna alla scelta
        </Link>
      </div>

      <h1 className="text-3xl font-extrabold">Registrati (Privato)</h1>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <section className="rounded-2xl border border-border bg-background p-5 space-y-3">
          <div className="text-sm font-extrabold">Dati account</div>

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
            {email.length > 0 && !emailOk ? <p className="mt-1 text-sm text-red-600">Inserisci un’email valida.</p> : null}
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
            {!pwOk && password.length > 0 ? <p className="mt-1 text-sm text-red-600">Minimo 8 caratteri (massimo 200).</p> : null}
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
            {confirmPassword.length > 0 && !pwMatch ? <p className="mt-1 text-sm text-red-600">Le password non coincidono.</p> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-background p-5 space-y-3">
          <div className="text-sm font-extrabold">Indirizzo di spedizione</div>

          <label className="block">
            <div className="text-sm font-medium">Indirizzo</div>
            <input className="mt-1 w-full rounded-md border p-3" value={shippingAddress.address} onChange={(e) => setShippingAddress((s) => ({ ...s, address: e.target.value }))} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-sm font-medium">Città</div>
              <input className="mt-1 w-full rounded-md border p-3" value={shippingAddress.city} onChange={(e) => setShippingAddress((s) => ({ ...s, city: e.target.value }))} />
            </label>
            <label className="block">
              <div className="text-sm font-medium">Provincia</div>
              <input className="mt-1 w-full rounded-md border p-3" value={shippingAddress.province} onChange={(e) => setShippingAddress((s) => ({ ...s, province: e.target.value }))} />
            </label>
          </div>

          <label className="block">
            <div className="text-sm font-medium">CAP</div>
            <input className="mt-1 w-full rounded-md border p-3" value={shippingAddress.postalCode} onChange={(e) => setShippingAddress((s) => ({ ...s, postalCode: e.target.value }))} inputMode="numeric" />
          </label>

          {shipErr ? <div className="text-sm text-red-600">{shipErr}</div> : null}
        </section>

        <section className="rounded-2xl border border-border bg-background p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-extrabold">Indirizzo di fatturazione</div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={billingSameAsShipping}
                onChange={(e) => setBillingSameAsShipping(e.target.checked)}
                disabled={loading}
              />
              Uguale alla spedizione
            </label>
          </div>

          {!billingSameAsShipping ? (
            <>
              <label className="block">
                <div className="text-sm font-medium">Indirizzo</div>
                <input className="mt-1 w-full rounded-md border p-3" value={billingAddress.address} onChange={(e) => setBillingAddress((s) => ({ ...s, address: e.target.value }))} />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-sm font-medium">Città</div>
                  <input className="mt-1 w-full rounded-md border p-3" value={billingAddress.city} onChange={(e) => setBillingAddress((s) => ({ ...s, city: e.target.value }))} />
                </label>
                <label className="block">
                  <div className="text-sm font-medium">Provincia</div>
                  <input className="mt-1 w-full rounded-md border p-3" value={billingAddress.province} onChange={(e) => setBillingAddress((s) => ({ ...s, province: e.target.value }))} />
                </label>
              </div>

              <label className="block">
                <div className="text-sm font-medium">CAP</div>
                <input className="mt-1 w-full rounded-md border p-3" value={billingAddress.postalCode} onChange={(e) => setBillingAddress((s) => ({ ...s, postalCode: e.target.value }))} inputMode="numeric" />
              </label>

              {billErr ? <div className="text-sm text-red-600">{billErr}</div> : null}
            </>
          ) : (
            <div className="text-sm text-text/70">Useremo lo stesso indirizzo della spedizione.</div>
          )}
        </section>

        {errorMsg ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{errorMsg}</div> : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full h-12 rounded-full bg-primary text-primary-contrast text-sm font-extrabold hover:bg-primary-hover transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
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
    </main>
  );
}
