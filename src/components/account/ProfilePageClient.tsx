"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Address = {
  address: string;
  city: string;
  postalCode: string;
  province: string;
  country: string;
};

type ProfilePayload = {
  ok: boolean;
  exists?: boolean;
  email?: string | null;
  customerType?: "PRIVATE" | "BUSINESS";
  firstName?: string;
  lastName?: string;
  shippingAddress?: Address | null;
  billingAddress?: Address | null;
  error?: string;
};

function normalizeAddress(a: any): Address {
  return {
    address: String(a?.address ?? ""),
    city: String(a?.city ?? ""),
    postalCode: String(a?.postalCode ?? ""),
    province: String(a?.province ?? ""),
    country: String(a?.country ?? "IT") || "IT",
  };
}

function clamp(v: string, max: number) {
  const s = (v ?? "").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max) : s;
}

function validateAddress(a: Address) {
  // Non obblighiamo tutto subito: ma se l’utente compila, deve essere sensato
  const hasAny = [a.address, a.city, a.postalCode, a.province, a.country].some((x) => x.trim().length > 0);
  if (!hasAny) return { ok: true, msg: "" };

  if (a.address.trim().length < 2) return { ok: false, msg: "Indirizzo non valido." };
  if (a.city.trim().length < 2) return { ok: false, msg: "Città non valida." };
  if (a.postalCode.trim().length < 3) return { ok: false, msg: "CAP non valido." };
  if (a.country.trim().length !== 2) return { ok: false, msg: "Paese non valido (usa 2 lettere, es. IT)." };

  return { ok: true, msg: "" };
}

export default function ProfilePageClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState("");
  const [customerType, setCustomerType] = useState<"PRIVATE" | "BUSINESS">("PRIVATE");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [shippingAddress, setShippingAddress] = useState<Address>({
    address: "",
    city: "",
    postalCode: "",
    province: "",
    country: "IT",
  });

  const [billingAddress, setBillingAddress] = useState<Address>({
    address: "",
    city: "",
    postalCode: "",
    province: "",
    country: "IT",
  });

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Validazioni minime
  const nameOk = useMemo(() => firstName.trim().length >= 2 && lastName.trim().length >= 2, [firstName, lastName]);
  const shipVal = useMemo(() => validateAddress(shippingAddress), [shippingAddress]);
  const billVal = useMemo(() => validateAddress(billingAddress), [billingAddress]);

  const canSave = nameOk && shipVal.ok && billVal.ok && !saving;

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      try {
        const res = await fetch("/api/account/profile", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          headers: { Accept: "application/json" },
        });

        const data = (await res.json().catch(() => null)) as ProfilePayload | null;

        if (!alive) return;

        if (!res.ok) {
          if (res.status === 401) {
            // non loggato
            window.location.href = "/accedi?next=/account/profile";
            return;
          }
          setErrorMsg("Impossibile caricare il profilo. Riprova.");
          return;
        }

        if (!data?.ok) {
          setErrorMsg("Impossibile caricare il profilo. Riprova.");
          return;
        }

        setEmail(String(data.email ?? ""));
        setCustomerType(data.customerType === "BUSINESS" ? "BUSINESS" : "PRIVATE");
        setFirstName(String(data.firstName ?? ""));
        setLastName(String(data.lastName ?? ""));

        setShippingAddress(normalizeAddress(data.shippingAddress));
        setBillingAddress(normalizeAddress(data.billingAddress));
      } catch {
        if (!alive) return;
        setErrorMsg("Errore di rete. Riprova.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!canSave) {
      if (!nameOk) setErrorMsg("Inserisci nome e cognome (minimo 2 caratteri).");
      else if (!shipVal.ok) setErrorMsg(shipVal.msg);
      else if (!billVal.ok) setErrorMsg(billVal.msg);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        firstName: clamp(firstName, 60),
        lastName: clamp(lastName, 60),
        shippingAddress: {
          address: clamp(shippingAddress.address, 160),
          city: clamp(shippingAddress.city, 80),
          postalCode: clamp(shippingAddress.postalCode, 12),
          province: clamp(shippingAddress.province, 40),
          country: clamp((shippingAddress.country || "IT").toUpperCase(), 2),
        },
        billingAddress: {
          address: clamp(billingAddress.address, 160),
          city: clamp(billingAddress.city, 80),
          postalCode: clamp(billingAddress.postalCode, 12),
          province: clamp(billingAddress.province, 40),
          country: clamp((billingAddress.country || "IT").toUpperCase(), 2),
        },
      };

      const res = await fetch("/api/account/profile", {
        method: "PUT",
        cache: "no-store",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        if (res.status === 401) {
          window.location.href = "/accedi?next=/account/profile";
          return;
        }
        setErrorMsg("Salvataggio non riuscito. Riprova.");
        return;
      }

      // aggiorna header
      window.dispatchEvent(new Event("tf:auth-changed"));

      setSuccessMsg("Salvato ✅");
    } catch {
      setErrorMsg("Errore di rete. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="h-8 w-40 rounded bg-surface animate-pulse" />
        <div className="mt-6 space-y-3">
          <div className="h-12 rounded bg-surface animate-pulse" />
          <div className="h-12 rounded bg-surface animate-pulse" />
          <div className="h-12 rounded bg-surface animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Profilo</h1>
        <Link href="/account" className="text-sm font-semibold underline">
          Torna alla dashboard
        </Link>
      </div>

      <p className="mt-2 text-sm text-muted-text">
        {customerType === "BUSINESS"
          ? "Completa i dati aziendali e gli indirizzi per fatturazione e spedizione."
          : "Completa i tuoi dati e gli indirizzi per spedizione e fatturazione."}
      </p>

      <form onSubmit={onSave} className="mt-6 space-y-6">
        {/* Dati base */}
        <section className="rounded-2xl border border-border bg-white p-5">
          <h2 className="text-lg font-bold">Dati account</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Email</label>
              <input className="mt-1 w-full rounded-md border p-3 bg-surface" value={email} readOnly />
            </div>

            <div className="hidden sm:block" />

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

          {!nameOk ? (
            <p className="mt-2 text-sm text-amber-700">Inserisci nome e cognome (minimo 2 caratteri).</p>
          ) : null}
        </section>

        {/* Spedizione */}
        <section className="rounded-2xl border border-border bg-white p-5">
          <h2 className="text-lg font-bold">Indirizzo di spedizione</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Indirizzo</label>
              <input
                className="mt-1 w-full rounded-md border p-3"
                value={shippingAddress.address}
                onChange={(e) => setShippingAddress((p) => ({ ...p, address: e.target.value }))}
                autoComplete="shipping street-address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Città</label>
              <input
                className="mt-1 w-full rounded-md border p-3"
                value={shippingAddress.city}
                onChange={(e) => setShippingAddress((p) => ({ ...p, city: e.target.value }))}
                autoComplete="shipping address-level2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">CAP</label>
              <input
                className="mt-1 w-full rounded-md border p-3"
                value={shippingAddress.postalCode}
                onChange={(e) => setShippingAddress((p) => ({ ...p, postalCode: e.target.value }))}
                autoComplete="shipping postal-code"
                inputMode="numeric"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Provincia</label>
              <input
                className="mt-1 w-full rounded-md border p-3"
                value={shippingAddress.province}
                onChange={(e) => setShippingAddress((p) => ({ ...p, province: e.target.value }))}
                autoComplete="shipping address-level1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Paese (2 lettere)</label>
              <input
                className="mt-1 w-full rounded-md border p-3 uppercase"
                value={shippingAddress.country}
                onChange={(e) => setShippingAddress((p) => ({ ...p, country: e.target.value }))}
                autoComplete="shipping country"
              />
            </div>
          </div>

          {!shipVal.ok ? <p className="mt-2 text-sm text-red-700">{shipVal.msg}</p> : null}
        </section>

        {/* Fatturazione */}
        <section className="rounded-2xl border border-border bg-white p-5">
          <h2 className="text-lg font-bold">Dati di fatturazione</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Indirizzo</label>
              <input
                className="mt-1 w-full rounded-md border p-3"
                value={billingAddress.address}
                onChange={(e) => setBillingAddress((p) => ({ ...p, address: e.target.value }))}
                autoComplete="billing street-address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Città</label>
              <input
                className="mt-1 w-full rounded-md border p-3"
                value={billingAddress.city}
                onChange={(e) => setBillingAddress((p) => ({ ...p, city: e.target.value }))}
                autoComplete="billing address-level2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">CAP</label>
              <input
                className="mt-1 w-full rounded-md border p-3"
                value={billingAddress.postalCode}
                onChange={(e) => setBillingAddress((p) => ({ ...p, postalCode: e.target.value }))}
                autoComplete="billing postal-code"
                inputMode="numeric"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Provincia</label>
              <input
                className="mt-1 w-full rounded-md border p-3"
                value={billingAddress.province}
                onChange={(e) => setBillingAddress((p) => ({ ...p, province: e.target.value }))}
                autoComplete="billing address-level1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Paese (2 lettere)</label>
              <input
                className="mt-1 w-full rounded-md border p-3 uppercase"
                value={billingAddress.country}
                onChange={(e) => setBillingAddress((p) => ({ ...p, country: e.target.value }))}
                autoComplete="billing country"
              />
            </div>
          </div>

          {!billVal.ok ? <p className="mt-2 text-sm text-red-700">{billVal.msg}</p> : null}
        </section>

        {errorMsg ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{errorMsg}</div>
        ) : null}

        {successMsg ? (
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">{successMsg}</div>
        ) : null}

        <button
          type="submit"
          disabled={!canSave}
          className="w-full rounded-full px-5 py-3 font-semibold disabled:opacity-50"
        >
          {saving ? "Salvataggio..." : "Salva modifiche"}
        </button>
      </form>
    </div>
  );
}
