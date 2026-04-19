// src/components/account/ProfilePageClient.tsx
"use client";

import type { FormEvent } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  fullName?: string | null;
  companyName?: string | null;
  vatNumber?: string | null;
  pec?: string | null;
  sdi?: string | null;
  shippingAddress?: Address | null;
  billingAddress?: Address | null;
  error?: string;
  message?: string;
  debug?: unknown;
};

const AUTH_EVENT = "tf:auth-changed";
const LOGIN_REDIRECT = "/accedi?next=/account/profilo";

const EMPTY_ADDRESS: Address = {
  address: "",
  city: "",
  postalCode: "",
  province: "",
  country: "IT",
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
  const coreEmpty = ![a.address, a.city, a.postalCode, a.province].some(
    (x) => String(x ?? "").trim().length > 0
  );
  const country = String(a.country ?? "").trim().toUpperCase();
  const countryIsDefaultOrEmpty = !country || country === "IT";
  return coreEmpty && countryIsDefaultOrEmpty;
}

function validateAddress(a: Address) {
  if (isEmptyAddress(a)) return { ok: true, msg: "" };
  if (a.address.trim().length < 2)
    return { ok: false, msg: "Indirizzo non valido." };
  if (a.city.trim().length < 2)
    return { ok: false, msg: "Città non valida." };
  if (a.postalCode.trim().length < 3)
    return { ok: false, msg: "CAP non valido." };
  if (toCountry2(a.country).trim().length !== 2)
    return {
      ok: false,
      msg: "Paese non valido (usa 2 lettere, es. IT).",
    };
  return { ok: true, msg: "" };
}

function isValidEmail(email: string) {
  const e = email.trim().toLowerCase();
  if (!e || e.length > 254) return false;
  if (/\s/.test(e)) return false;
  const at = e.indexOf("@");
  if (at <= 0 || at !== e.lastIndexOf("@")) return false;
  const domain = e.slice(at + 1);
  if (!domain || !domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
    return false;
  }
  return true;
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

function applyAddressFromServer(
  current: Address,
  incoming: Address | null | undefined
): Address {
  if (incoming === undefined) return current;
  if (incoming === null) return { ...EMPTY_ADDRESS };
  const inc = normalizeAddress(incoming);
  const incN: Address = { ...inc, country: toCountry2(inc.country || "IT") };
  if (isEmptyAddress(incN)) return { ...EMPTY_ADDRESS };
  return incN;
}

function Field(props: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  readOnly?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  className?: string;
}) {
  const {
    label,
    value,
    onChange,
    type = "text",
    readOnly,
    disabled,
    autoComplete,
    inputMode,
    maxLength,
    className = "",
  } = props;

  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <input
        className={`mt-1 w-full rounded-md border p-3 ${
          readOnly || disabled ? "bg-surface text-text/60" : ""
        } ${className}`}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        type={type}
        readOnly={readOnly}
        disabled={disabled}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
      />
    </div>
  );
}

export default function ProfilePageClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState("");
  const [customerType, setCustomerType] =
    useState<"PRIVATE" | "BUSINESS">("PRIVATE");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [pec, setPec] = useState("");
  const [sdi, setSdi] = useState("");

  const [shippingAddress, setShippingAddress] =
    useState<Address>({ ...EMPTY_ADDRESS });
  const [billingAddress, setBillingAddress] =
    useState<Address>({ ...EMPTY_ADDRESS });

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

  const nameOk = useMemo(
    () => firstName.trim().length >= 2 && lastName.trim().length >= 2,
    [firstName, lastName]
  );

  const isBusiness = customerType === "BUSINESS";

  const companyOk = useMemo(
    () => !isBusiness || companyName.trim().length >= 2,
    [isBusiness, companyName]
  );
  const vatOk = useMemo(
    () => !isBusiness || vatNumber.trim().length >= 5,
    [isBusiness, vatNumber]
  );
  const pecOk = useMemo(
    () => !isBusiness || isValidEmail(pec),
    [isBusiness, pec]
  );
  const sdiOk = useMemo(
    () => !isBusiness || sdi.trim().length >= 3,
    [isBusiness, sdi]
  );

  const shipVal = useMemo(
    () => validateAddress(shippingAddress),
    [shippingAddress]
  );
  const billVal = useMemo(
    () => validateAddress(billingAddress),
    [billingAddress]
  );

  const canSave =
    nameOk &&
    companyOk &&
    vatOk &&
    pecOk &&
    sdiOk &&
    shipVal.ok &&
    billVal.ok &&
    !saving;

  useEffect(() => {
    if (!didLoadRef.current) return;
    if (sameAsShipping) setBillingAddress(shippingAddress);
  }, [shippingAddress, sameAsShipping]);

  const applyProfileNonDestructive = useCallback((data: ProfilePayload) => {
    setEmail((cur) => preferNonEmpty(cur, data.email ?? ""));
    setCustomerType(
      data.customerType === "BUSINESS" ? "BUSINESS" : "PRIVATE"
    );

    setFirstName((cur) => preferNonEmpty(cur, data.firstName ?? ""));
    setLastName((cur) => preferNonEmpty(cur, data.lastName ?? ""));

    setCompanyName((cur) => preferNonEmpty(cur, data.companyName ?? ""));
    setVatNumber((cur) => preferNonEmpty(cur, data.vatNumber ?? ""));
    setPec((cur) => preferNonEmpty(cur, data.pec ?? ""));
    setSdi((cur) => preferNonEmpty(cur, data.sdi ?? ""));

    setShippingAddress((cur) =>
      applyAddressFromServer(cur, data.shippingAddress)
    );
    setBillingAddress((cur) =>
      applyAddressFromServer(cur, data.billingAddress)
    );

    if (data.shippingAddress !== undefined && data.billingAddress !== undefined) {
      const ship = data.shippingAddress
        ? normalizeAddress(data.shippingAddress)
        : null;
      const bill = data.billingAddress
        ? normalizeAddress(data.billingAddress)
        : null;

      const same =
        (ship === null && bill === null) ||
        (ship !== null &&
          bill !== null &&
          JSON.stringify({
            ...ship,
            country: toCountry2(ship.country || "IT"),
          }) ===
            JSON.stringify({
              ...bill,
              country: toCountry2(bill.country || "IT"),
            }));

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

      const data = (await res.json().catch(() => null)) as
        | ProfilePayload
        | null;
      if (!aliveRef.current) return;
      if (!res.ok) {
        if (res.status === 401) window.location.href = LOGIN_REDIRECT;
        return;
      }
      if (!data?.ok) return;
      applyProfileNonDestructive(data);
    } catch {
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

        const data = (await res.json().catch(() => null)) as
          | ProfilePayload
          | null;
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

        setEmail(String(data.email ?? ""));
        setCustomerType(
          data.customerType === "BUSINESS" ? "BUSINESS" : "PRIVATE"
        );
        setFirstName(String(data.firstName ?? ""));
        setLastName(String(data.lastName ?? ""));

        setCompanyName(String(data.companyName ?? ""));
        setVatNumber(String(data.vatNumber ?? ""));
        setPec(String(data.pec ?? ""));
        setSdi(String(data.sdi ?? ""));

        setShippingAddress(
          applyAddressFromServer({ ...EMPTY_ADDRESS }, data.shippingAddress)
        );
        setBillingAddress(
          applyAddressFromServer({ ...EMPTY_ADDRESS }, data.billingAddress)
        );

        const ship = data.shippingAddress
          ? normalizeAddress(data.shippingAddress)
          : null;
        const bill = data.billingAddress
          ? normalizeAddress(data.billingAddress)
          : null;

        const same =
          (ship === null && bill === null) ||
          (ship !== null &&
            bill !== null &&
            JSON.stringify({
              ...ship,
              country: toCountry2(ship.country || "IT"),
            }) ===
              JSON.stringify({
                ...bill,
                country: toCountry2(bill.country || "IT"),
              }));

        setSameAsShipping(Boolean(same));
      } catch {
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
      if (!nameOk)
        setErrorMsg("Inserisci nome e cognome (minimo 2 caratteri).");
      else if (!companyOk)
        setErrorMsg("Inserisci la ragione sociale.");
      else if (!vatOk)
        setErrorMsg("Inserisci una Partita IVA valida.");
      else if (!pecOk)
        setErrorMsg("Inserisci una PEC valida.");
      else if (!sdiOk)
        setErrorMsg("Inserisci il codice SDI.");
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

      const payload: Record<string, any> = {
        firstName: clamp(firstName, 60),
        lastName: clamp(lastName, 60),
        shippingAddress: isEmptyAddress(ship) ? null : ship,
        billingAddress: isEmptyAddress(bill) ? null : bill,
      };

      if (isBusiness) {
        payload.companyName = clamp(companyName, 140);
        payload.vatNumber = clamp(vatNumber, 40);
        payload.pec = pec.trim().toLowerCase().slice(0, 254);
        payload.sdi = sdi.trim().toUpperCase().slice(0, 20);
      }

      const res = await fetch("/api/account/profile", {
        method: "PUT",
        cache: "no-store",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => null)) as
        | ProfilePayload
        | null;

      if (!res.ok || !data?.ok) {
        if (res.status === 401) {
          window.location.href = LOGIN_REDIRECT;
          return;
        }
        setErrorMsg(data?.message || "Salvataggio non riuscito. Riprova.");
        if (data?.debug) setDebugMsg(JSON.stringify(data.debug, null, 2));
        return;
      }

      window.dispatchEvent(new Event(AUTH_EVENT));
      setSuccessMsg("Salvato ✅");

      applyProfileNonDestructive(data);
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

      <p className="mt-2 text-sm text-text/70">
        {isBusiness
          ? "Completa i dati aziendali e gli indirizzi di spedizione e fatturazione."
          : "Completa i tuoi dati e gli indirizzi di spedizione e fatturazione."}
      </p>

      <form onSubmit={onSave} className="mt-6 space-y-6" noValidate>
        {isBusiness && (
          <section className="rounded-2xl border border-border bg-white p-5">
            <h2 className="text-lg font-bold">Dati azienda</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field
                  label="Ragione sociale"
                  value={companyName}
                  onChange={setCompanyName}
                  maxLength={140}
                  autoComplete="organization"
                />
                {companyName.length > 0 && !companyOk && (
                  <p className="mt-1 text-sm text-red-600">
                    Inserisci la ragione sociale.
                  </p>
                )}
              </div>

              <div>
                <Field
                  label="Partita IVA"
                  value={vatNumber}
                  onChange={setVatNumber}
                  maxLength={40}
                />
                {vatNumber.length > 0 && !vatOk && (
                  <p className="mt-1 text-sm text-red-600">
                    Partita IVA non valida.
                  </p>
                )}
              </div>

              <div>
                <Field
                  label="Codice SDI"
                  value={sdi}
                  onChange={(v) => setSdi(v.toUpperCase())}
                  maxLength={20}
                  className="uppercase"
                />
                {sdi.length > 0 && !sdiOk && (
                  <p className="mt-1 text-sm text-red-600">
                    Inserisci il codice SDI.
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <Field
                  label="PEC"
                  value={pec}
                  onChange={(v) => setPec(v.toLowerCase())}
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                />
                {pec.length > 0 && !pecOk && (
                  <p className="mt-1 text-sm text-red-600">
                    Inserisci una PEC valida.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-border bg-white p-5">
          <h2 className="text-lg font-bold">Dati account</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Email" value={email} readOnly />
            </div>

            <div>
              <Field
                label="Nome"
                value={firstName}
                onChange={setFirstName}
                autoComplete="given-name"
                maxLength={60}
              />
            </div>

            <div>
              <Field
                label="Cognome"
                value={lastName}
                onChange={setLastName}
                autoComplete="family-name"
                maxLength={60}
              />
            </div>
          </div>

          {!nameOk && (firstName.length > 0 || lastName.length > 0) && (
            <p className="mt-2 text-sm text-amber-700">
              Inserisci nome e cognome (minimo 2 caratteri).
            </p>
          )}

          <p className="mt-3 text-sm text-text/70">
            Anteprima header: <span className="font-semibold">Ciao,</span>{" "}
            {firstToken(firstName) || "Account"}
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-white p-5">
          <h2 className="text-lg font-bold">Indirizzo di spedizione</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field
                label="Indirizzo"
                value={shippingAddress.address}
                onChange={(v) =>
                  setShippingAddress((p) => ({ ...p, address: v }))
                }
                autoComplete="shipping street-address"
              />
            </div>

            <Field
              label="Città"
              value={shippingAddress.city}
              onChange={(v) =>
                setShippingAddress((p) => ({ ...p, city: v }))
              }
              autoComplete="shipping address-level2"
            />

            <Field
              label="CAP"
              value={shippingAddress.postalCode}
              onChange={(v) =>
                setShippingAddress((p) => ({ ...p, postalCode: v }))
              }
              autoComplete="shipping postal-code"
              inputMode="numeric"
            />

            <Field
              label="Provincia"
              value={shippingAddress.province}
              onChange={(v) =>
                setShippingAddress((p) => ({ ...p, province: v }))
              }
              autoComplete="shipping address-level1"
            />

            <Field
              label="Paese (2 lettere)"
              value={shippingAddress.country}
              onChange={(v) =>
                setShippingAddress((p) => ({ ...p, country: v }))
              }
              autoComplete="shipping country"
              className="uppercase"
            />
          </div>

          {!shipVal.ok && (
            <p className="mt-2 text-sm text-red-700">{shipVal.msg}</p>
          )}
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

          {sameAsShipping ? (
            <p className="mt-3 text-sm text-text/70">
              Useremo lo stesso indirizzo della spedizione.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field
                  label="Indirizzo"
                  value={billingAddress.address}
                  onChange={(v) =>
                    setBillingAddress((p) => ({ ...p, address: v }))
                  }
                  autoComplete="billing street-address"
                />
              </div>

              <Field
                label="Città"
                value={billingAddress.city}
                onChange={(v) =>
                  setBillingAddress((p) => ({ ...p, city: v }))
                }
                autoComplete="billing address-level2"
              />

              <Field
                label="CAP"
                value={billingAddress.postalCode}
                onChange={(v) =>
                  setBillingAddress((p) => ({ ...p, postalCode: v }))
                }
                autoComplete="billing postal-code"
                inputMode="numeric"
              />

              <Field
                label="Provincia"
                value={billingAddress.province}
                onChange={(v) =>
                  setBillingAddress((p) => ({ ...p, province: v }))
                }
                autoComplete="billing address-level1"
              />

              <Field
                label="Paese (2 lettere)"
                value={billingAddress.country}
                onChange={(v) =>
                  setBillingAddress((p) => ({ ...p, country: v }))
                }
                autoComplete="billing country"
                className="uppercase"
              />
            </div>
          )}

          {!billVal.ok && (
            <p className="mt-2 text-sm text-red-700">{billVal.msg}</p>
          )}
        </section>

        {errorMsg && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {errorMsg}
            {debugMsg && (
              <pre className="mt-3 max-h-64 overflow-auto rounded bg-white/60 p-3 text-xs text-red-900">
                {debugMsg}
              </pre>
            )}
          </div>
        )}

        {successMsg && (
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {successMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSave}
          className="w-full h-12 rounded-full bg-primary text-primary-contrast text-sm font-extrabold hover:bg-primary-hover transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Salvataggio..." : "Salva modifiche"}
        </button>
      </form>
    </div>
  );
}
