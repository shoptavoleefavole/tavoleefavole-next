"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  message?: string;
  debug?: any; // utile se la route lo ritorna in dev
};

const AUTH_EVENT = "tf:auth-changed";

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
  const s = String(v ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > max ? s.slice(0, max) : s;
}

function toCountry2(v: string) {
  const s = clamp(v, 2).toUpperCase();
  return s.length === 2 ? s : "IT";
}

function isEmptyAddress(a: Address) {
  return ![a.address, a.city, a.postalCode, a.province, a.country].some((x) => String(x ?? "").trim().length > 0);
}

function validateAddress(a: Address) {
  const hasAny = !isEmptyAddress(a);
  if (!hasAny) return { ok: true, msg: "" };

  if (a.address.trim().length < 2) return { ok: false, msg: "Indirizzo non valido." };
  if (a.city.trim().length < 2) return { ok: false, msg: "Città non valida." };
  if (a.postalCode.trim().length < 3) return { ok: false, msg: "CAP non valido." };
  if (toCountry2(a.country).trim().length !== 2) return { ok: false, msg: "Paese non valido (usa 2 lettere, es. IT)." };

  return { ok: true, msg: "" };
}

function firstToken(full: string) {
  const s = String(full ?? "").trim();
  if (!s) return "";
  return s.split(/\s+/)[0] || s;
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

  const [sameAsShipping, setSameAsShipping] = useState(false);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [debugMsg, setDebugMsg] = useState<string | null>(null);

  const didLoadRef = useRef(false);

  // Validazioni minime
  const nameOk = useMemo(() => firstName.trim().length >= 2 && lastName.trim().length >= 2, [firstName, lastName]);
  const shipVal = useMemo(() => validateAddress(shippingAddress), [shippingAddress]);
  const billVal = useMemo(() => validateAddress(billingAddress), [billingAddress]);

  const canSave = nameOk && shipVal.ok && billVal.ok && !saving;

  // sync billing se flag attivo
  useEffect(() => {
    if (!didLoadRef.current) return;
    if (sameAsShipping) setBillingAddress(shippingAddress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shippingAddress, sameAsShipping]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErrorMsg(null);
      setDebugMsg(null);
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
            window.location.href = "/accedi?next=/account/profile";
            return;
          }
          setErrorMsg("Impossibile caricare il profilo. Riprova.");
          return;
        }

        if (!data?.ok) {
          setErrorMsg(data?.message || "Impossibile caricare il profilo. Riprova.");
          if (data?.debug) setDebugMsg(JSON.stringify(data.debug, null, 2));
          return;
        }

        setEmail(String(data.email ?? ""));
        setCustomerType(data.customerType === "BUSINESS" ? "BUSINESS" : "PRIVATE");

        setFirstName(String(data.firstName ?? ""));
        setLastName(String(data.lastName ?? ""));

        const ship = normalizeAddress(data.shippingAddress);
        const bill = normalizeAddress(data.billingAddress);

        setShippingAddress({
          ...ship,
          country: toCountry2(ship.country || "IT"),
        });

        setBillingAddress({
          ...bill,
          country: toCountry2(bill.country || "IT"),
        });

        // auto-flag se già uguali
        const same =
          JSON.stringify({ ...ship, country: toCountry2(ship.country || "IT") }) ===
          JSON.stringify({ ...bill, country: toCountry2(bill.country || "IT") });
        setSameAsShipping(Boolean(same));
      } catch {
        if (!alive) return;
        setErrorMsg("Errore di rete. Riprova.");
      } finally {
        if (!alive) return;
        didLoadRef.current = true;
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
    setDebugMsg(null);

    if (!canSave) {
      if (!nameOk) setErrorMsg("Inserisci nome e cognome (minimo 2 caratteri).");
      else if (!shipVal.ok) setErrorMsg(shipVal.msg);
      else if (!billVal.ok) setErrorMsg(billVal.msg);
      return;
    }

    if (saving) return; // hard stop double-submit
    setSaving(true);

    try {
      const ship = {
        address: clamp(shippingAddress.address, 160),
        city: clamp(shippingAddress.city, 80),
        postalCode: clamp(shippingAddress.postalCode, 12),
        province: clamp(shippingAddress.province, 40),
        country: toCountry2(shippingAddress.country || "IT"),
      };

      const billBase = sameAsShipping ? ship : billingAddress;

      const bill = {
        address: clamp(billBase.address, 160),
        city: clamp(billBase.city, 80),
        postalCode: clamp(billBase.postalCode, 12),
        province: clamp(billBase.province, 40),
        country: toCountry2(billBase.country || "IT"),
      };

      // IMPORTANT: se un address è completamente vuoto, mandiamo null (evita validation su componenti)
      const payload = {
        firstName: clamp(firstName, 60),
        lastName: clamp(lastName, 60),
        shippingAddress: isEmptyAddress(ship) ? null : ship,
        billingAddress: isEmptyAddress(bill) ? null : bill,
      };

      const res = await fetch("/api/account/profile", {
        method: "PUT",
        cache: "no-store",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => null)) as ProfilePayload | null;

      if (!res.ok || !data?.ok) {
        if (res.status === 401) {
          window.location.href = "/accedi?next=/account/profile";
          return;
        }

        setErrorMsg(data?.message || "Salvataggio non riuscito. Riprova.");

        // se la route in dev manda debug, mostralo
        if (data?.debug) setDebugMsg(JSON.stringify(data.debug, null, 2));
        return;
      }

      window.dispatchEvent(new Event(AUTH_EVENT));
      setSuccessMsg("Salvato ✅");

      // Aggiorna anche lo stato locale: se sameAsShipping, riallinea billing
      if (sameAsShipping) setBillingAddress(ship);
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

          {/* mini-preview UI: Benvenuto, Nome */}
          <p className="mt-3 text-sm text-muted-text">
            Anteprima header: <span className="font-semibold">Benvenuto,</span> {firstToken(firstName) || "Account"}
          </p>
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
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-bold">Dati di fatturazione</h2>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sameAsShipping}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setSameAsShipping(checked);
                  if (checked) setBillingAddress(shippingAddress);
                }}
              />
              Coincide con spedizione
            </label>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Indirizzo</label>
              <input
                className="mt-1 w-full rounded-md border p-3"
                value={sameAsShipping ? shippingAddress.address : billingAddress.address}
                onChange={(e) => setBillingAddress((p) => ({ ...p, address: e.target.value }))}
                autoComplete="billing street-address"
                disabled={sameAsShipping}
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Città</label>
              <input
                className="mt-1 w-full rounded-md border p-3"
                value={sameAsShipping ? shippingAddress.city : billingAddress.city}
                onChange={(e) => setBillingAddress((p) => ({ ...p, city: e.target.value }))}
                autoComplete="billing address-level2"
                disabled={sameAsShipping}
              />
            </div>

            <div>
              <label className="block text-sm font-medium">CAP</label>
              <input
                className="mt-1 w-full rounded-md border p-3"
                value={sameAsShipping ? shippingAddress.postalCode : billingAddress.postalCode}
                onChange={(e) => setBillingAddress((p) => ({ ...p, postalCode: e.target.value }))}
                autoComplete="billing postal-code"
                inputMode="numeric"
                disabled={sameAsShipping}
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Provincia</label>
              <input
                className="mt-1 w-full rounded-md border p-3"
                value={sameAsShipping ? shippingAddress.province : billingAddress.province}
                onChange={(e) => setBillingAddress((p) => ({ ...p, province: e.target.value }))}
                autoComplete="billing address-level1"
                disabled={sameAsShipping}
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Paese (2 lettere)</label>
              <input
                className="mt-1 w-full rounded-md border p-3 uppercase"
                value={sameAsShipping ? shippingAddress.country : billingAddress.country}
                onChange={(e) => setBillingAddress((p) => ({ ...p, country: e.target.value }))}
                autoComplete="billing country"
                disabled={sameAsShipping}
              />
            </div>
          </div>

          {!billVal.ok ? <p className="mt-2 text-sm text-red-700">{billVal.msg}</p> : null}
        </section>

        {errorMsg ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {errorMsg}
            {debugMsg ? (
              <pre className="mt-3 max-h-64 overflow-auto rounded bg-white/60 p-3 text-xs text-red-900">
                {debugMsg}
              </pre>
            ) : null}
          </div>
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
