"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  firstName?: string | null;
  lastName?: string | null;
  shippingAddress?: Address | null;
  billingAddress?: Address | null;
  error?: string;
  message?: string;
  debug?: unknown;
};

const AUTH_EVENT = "tf:auth-changed";
const LOGIN_REDIRECT = "/accedi?next=/account/profilo";
const EMPTY_ADDRESS: Address = { address: "", city: "", postalCode: "", province: "", country: "IT" };

function normalizeAddress(a: any): Address {
  return {
    address: String(a?.address ?? ""),
    city: String(a?.city ?? ""),
    postalCode: String(a?.postalCode ?? ""),
    province: String(a?.province ?? ""),
    country: String(a?.country ?? "IT") || "IT",
  };
}

function clamp(v: unknown, max: number) {
  const s = String(v ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > max ? s.slice(0, max) : s;
}

function toCountry2(v: unknown) {
  const s = clamp(v, 2).toUpperCase();
  return s.length === 2 ? s : "IT";
}

function isEmptyAddress(a: Address) {
  const coreEmpty = ![a.address, a.city, a.postalCode, a.province].some((x) => String(x ?? "").trim().length > 0);
  const country = String(a.country ?? "").trim().toUpperCase();
  const countryIsDefaultOrEmpty = !country || country === "IT";
  return coreEmpty && countryIsDefaultOrEmpty;
}

function validateAddress(a: Address) {
  if (isEmptyAddress(a)) return { ok: true, msg: "" };

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

function preferNonEmpty(current: string, incoming: unknown): string {
  const next = String(incoming ?? "").trim();
  return next ? next : current;
}

function applyAddressFromServer(current: Address, incoming: Address | null | undefined): Address {
  // undefined => non tocchiamo
  if (incoming === undefined) return current;
  // null => reset (server dice “non c’è”)
  if (incoming === null) return { ...EMPTY_ADDRESS };

  const inc = normalizeAddress(incoming);
  const incN: Address = { ...inc, country: toCountry2(inc.country || "IT") };

  // se server manda oggetto vuoto, consideriamolo vuoto
  if (isEmptyAddress(incN)) return { ...EMPTY_ADDRESS };

  return incN;
}

export default function ProfilePageClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState("");
  const [customerType, setCustomerType] = useState<"PRIVATE" | "BUSINESS">("PRIVATE");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [shippingAddress, setShippingAddress] = useState<Address>({ ...EMPTY_ADDRESS });
  const [billingAddress, setBillingAddress] = useState<Address>({ ...EMPTY_ADDRESS });

  const [sameAsShipping, setSameAsShipping] = useState(false);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [debugMsg, setDebugMsg] = useState<string | null>(null);

  const didLoadRef = useRef(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const nameOk = useMemo(() => firstName.trim().length >= 2 && lastName.trim().length >= 2, [firstName, lastName]);
  const shipVal = useMemo(() => validateAddress(shippingAddress), [shippingAddress]);
  const billVal = useMemo(() => validateAddress(billingAddress), [billingAddress]);

  const canSave = nameOk && shipVal.ok && billVal.ok && !saving;

  useEffect(() => {
    if (!didLoadRef.current) return;
    if (sameAsShipping) setBillingAddress(shippingAddress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shippingAddress, sameAsShipping]);

  const applyProfileNonDestructive = useCallback((data: ProfilePayload) => {
    setEmail((cur) => preferNonEmpty(cur, data.email ?? ""));
    setCustomerType(data.customerType === "BUSINESS" ? "BUSINESS" : "PRIVATE");

    // 🔒 NON sovrascrivere nome/cognome con vuoto
    setFirstName((cur) => preferNonEmpty(cur, data.firstName ?? ""));
    setLastName((cur) => preferNonEmpty(cur, data.lastName ?? ""));

    // indirizzi: reset solo se null, altrimenti applica
    setShippingAddress((cur) => applyAddressFromServer(cur, data.shippingAddress));
    setBillingAddress((cur) => applyAddressFromServer(cur, data.billingAddress));

    // sameAsShipping (ricalcola solo se server ci dà entrambi)
    if (data.shippingAddress !== undefined && data.billingAddress !== undefined) {
      const ship = data.shippingAddress ? normalizeAddress(data.shippingAddress) : null;
      const bill = data.billingAddress ? normalizeAddress(data.billingAddress) : null;

      const same =
        (ship === null && bill === null) ||
        (ship !== null &&
          bill !== null &&
          JSON.stringify({ ...ship, country: toCountry2(ship.country || "IT") }) ===
            JSON.stringify({ ...bill, country: toCountry2(bill.country || "IT") }));

      setSameAsShipping(Boolean(same));
    }
  }, []);

  const reloadProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/account/profile", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const data = (await res.json().catch(() => null)) as ProfilePayload | null;
      if (!aliveRef.current) return;

      if (!res.ok) {
        if (res.status === 401) window.location.href = LOGIN_REDIRECT;
        return;
      }
      if (!data?.ok) return;

      // ✅ refresh “non distruttivo”
      applyProfileNonDestructive(data);
    } catch {
      // best-effort
    }
  }, [applyProfileNonDestructive]);

  useEffect(() => {
    let canceled = false;

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
        if (canceled || !aliveRef.current) return;

        if (!res.ok) {
          if (res.status === 401) window.location.href = LOGIN_REDIRECT;
          else setErrorMsg("Impossibile caricare il profilo. Riprova.");
          return;
        }

        if (!data?.ok) {
          setErrorMsg(data?.message || "Impossibile caricare il profilo. Riprova.");
          if (data?.debug) setDebugMsg(JSON.stringify(data.debug, null, 2));
          return;
        }

        // primo load: applica completo
        setEmail(String(data.email ?? ""));
        setCustomerType(data.customerType === "BUSINESS" ? "BUSINESS" : "PRIVATE");
        setFirstName(String(data.firstName ?? ""));
        setLastName(String(data.lastName ?? ""));

        setShippingAddress(applyAddressFromServer({ ...EMPTY_ADDRESS }, data.shippingAddress));
        setBillingAddress(applyAddressFromServer({ ...EMPTY_ADDRESS }, data.billingAddress));

        const ship = data.shippingAddress ? normalizeAddress(data.shippingAddress) : null;
        const bill = data.billingAddress ? normalizeAddress(data.billingAddress) : null;

        const same =
          (ship === null && bill === null) ||
          (ship !== null &&
            bill !== null &&
            JSON.stringify({ ...ship, country: toCountry2(ship.country || "IT") }) ===
              JSON.stringify({ ...bill, country: toCountry2(bill.country || "IT") }));

        setSameAsShipping(Boolean(same));
      } catch {
        // ✅ FIX: non settare stato se unmounted/canceled
        if (canceled || !aliveRef.current) return;
        setErrorMsg("Errore di rete. Riprova.");
      } finally {
        if (canceled || !aliveRef.current) return;
        didLoadRef.current = true;
        setLoading(false);
      }
    })();

    return () => {
      canceled = true;
    };
  }, []);

  async function onSave(e: FormEvent) {
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

    if (saving) return;
    setSaving(true);

    try {
      const ship: Address = {
        address: clamp(shippingAddress.address, 160),
        city: clamp(shippingAddress.city, 80),
        postalCode: clamp(shippingAddress.postalCode, 12),
        province: clamp(shippingAddress.province, 40),
        country: toCountry2(shippingAddress.country || "IT"),
      };

      const billBase = sameAsShipping ? ship : billingAddress;

      const bill: Address = {
        address: clamp(billBase.address, 160),
        city: clamp(billBase.city, 80),
        postalCode: clamp(billBase.postalCode, 12),
        province: clamp(billBase.province, 40),
        country: toCountry2(billBase.country || "IT"),
      };

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
          window.location.href = LOGIN_REDIRECT;
          return;
        }
        setErrorMsg(data?.message || "Salvataggio non riuscito. Riprova.");
        if (data?.debug) setDebugMsg(JSON.stringify(data.debug, null, 2));
        return;
      }

      // ✅ optimistic: i campi restano pieni SEMPRE
      setFirstName(payload.firstName);
      setLastName(payload.lastName);

      const nextShip = payload.shippingAddress ? { ...payload.shippingAddress } : { ...EMPTY_ADDRESS };
      const nextBill =
        payload.billingAddress
          ? { ...payload.billingAddress }
          : sameAsShipping
            ? { ...nextShip }
            : { ...EMPTY_ADDRESS };

      setShippingAddress(nextShip);
      setBillingAddress(nextBill);

      window.dispatchEvent(new Event(AUTH_EVENT));
      setSuccessMsg("Salvato ✅");

      // ✅ applica risposta server non distruttiva
      applyProfileNonDestructive(data);

      // ✅ refresh non distruttivo (best-effort)
      void reloadProfile();
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

          {!nameOk ? <p className="mt-2 text-sm text-amber-700">Inserisci nome e cognome (minimo 2 caratteri).</p> : null}

          <p className="mt-3 text-sm text-muted-text">
            Anteprima header: <span className="font-semibold">Benvenuto,</span> {firstToken(firstName) || "Account"}
          </p>
        </section>

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
              <pre className="mt-3 max-h-64 overflow-auto rounded bg-white/60 p-3 text-xs text-red-900">{debugMsg}</pre>
            ) : null}
          </div>
        ) : null}

        {successMsg ? (
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">{successMsg}</div>
        ) : null}

        <button type="submit" disabled={!canSave} className="w-full rounded-full px-5 py-3 font-semibold disabled:opacity-50">
          {saving ? "Salvataggio..." : "Salva modifiche"}
        </button>
      </form>
    </div>
  );
}
