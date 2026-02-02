"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type BillingType = "PRIVATE" | "AZIENDE";

type ProfileForm = {
  billingType: BillingType;

  firstName: string;
  lastName: string;
  fiscalCode: string;
  phone: string;

  address: string;
  city: string;
  postalCode: string;
  province: string;
  country: string;

  companyName: string;
  vatNumber: string;
  sdi: string;
  pec: string;

  email: string;
};

const LS_KEY = "tf_profile_v1";

function pickStr(v: any) {
  return typeof v === "string" ? v : "";
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeFromMe(me: any): Partial<ProfileForm> {
  // se aggiungi campi custom a User in Strapi, verranno qui automaticamente
  const billingType = String(me?.billingType || "PRIVATE").toUpperCase() === "AZIENDE" ? "AZIENDE" : "PRIVATE";

  return {
    billingType,
    firstName: pickStr(me?.firstName),
    lastName: pickStr(me?.lastName),
    fiscalCode: pickStr(me?.fiscalCode),
    phone: pickStr(me?.phone),

    address: pickStr(me?.address),
    city: pickStr(me?.city),
    postalCode: pickStr(me?.postalCode),
    province: pickStr(me?.province),
    country: pickStr(me?.country) || "IT",

    companyName: pickStr(me?.companyName),
    vatNumber: pickStr(me?.vatNumber),
    sdi: pickStr(me?.sdi),
    pec: pickStr(me?.pec),

    email: pickStr(me?.email),
  };
}

function loadFromLocalStorage(): Partial<ProfileForm> {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const j = safeJsonParse(raw);
    return j && typeof j === "object" ? (j as Partial<ProfileForm>) : {};
  } catch {
    return {};
  }
}

function saveToLocalStorage(v: ProfileForm) {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(v));
  } catch {
    // ignore
  }
}

function emptyForm(): ProfileForm {
  return {
    billingType: "PRIVATE",
    firstName: "",
    lastName: "",
    fiscalCode: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
    province: "",
    country: "IT",
    companyName: "",
    vatNumber: "",
    sdi: "",
    pec: "",
    email: "",
  };
}

export default function ProfilePageClient() {
  const [form, setForm] = useState<ProfileForm>(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const isCompany = form.billingType === "AZIENDE";

  useEffect(() => {
    // 1) prefill immediato da localStorage
    const local = loadFromLocalStorage();
    setForm((prev) => ({ ...prev, ...local }));
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      setLoading(true);
      setErr("");
      setMsg("");

      try {
        const res = await fetch("/api/account/profile", { cache: "no-store", signal: controller.signal });
        const text = await res.text().catch(() => "");
        const json = safeJsonParse(text);

        if (!res.ok || !json?.ok) {
          setLoading(false);
          return; // non blocco: localStorage resta valido
        }

        const me = json.me;
        const fromMe = normalizeFromMe(me);

        setForm((prev) => {
          const merged = { ...prev, ...fromMe } as ProfileForm;
          saveToLocalStorage(merged);
          return merged;
        });
      } catch {
        // ignore
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, []);

  const validationError = useMemo(() => {
    if (isCompany) {
      if (!form.companyName.trim()) return "Ragione sociale mancante";
      if (!form.vatNumber.trim()) return "Partita IVA mancante";
    }
    return "";
  }, [form, isCompany]);

  async function save() {
    setSaving(true);
    setErr("");
    setMsg("");

    if (validationError) {
      setSaving(false);
      setErr(validationError);
      return;
    }

    // salva SEMPRE in localStorage (prefill checkout garantito)
    saveToLocalStorage(form);

    try {
      const res = await fetch("/api/account/profile", {
        method: "PUT",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const text = await res.text().catch(() => "");
      const json = safeJsonParse(text);

      if (!res.ok || !json?.ok) {
        setMsg("Salvato sul browser ✅ (Strapi non aggiornato)");
        setSaving(false);
        return;
      }

      setMsg("Profilo salvato ✅");
      setSaving(false);
    } catch (e: any) {
      setMsg("Salvato sul browser ✅ (rete/Strapi non raggiungibile)");
      setSaving(false);
    }
  }

  function set<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 pb-24 md:pb-10">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Profilo</h1>
        <Link href="/account" className="text-sm font-extrabold hover:underline">
          ← Account
        </Link>
      </div>

      <div className="mt-2 text-sm text-text/70">
        Questi dati verranno usati per <b>precompilare il checkout</b>.
      </div>

      {loading ? (
        <div className="mt-6 rounded-2xl border border-border bg-background p-4 text-sm text-text/70">
          Caricamento…
        </div>
      ) : null}

      <div className="mt-6 grid gap-3">
        <div className="rounded-2xl border border-border bg-background p-4">
          <div className="text-sm font-extrabold">Tipo fatturazione</div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => set("billingType", "PRIVATE")}
              className={`h-10 rounded-xl border px-4 text-sm font-extrabold ${
                form.billingType === "PRIVATE" ? "border-text bg-surface" : "border-border bg-background hover:bg-surface-2"
              }`}
            >
              Privato
            </button>
            <button
              type="button"
              onClick={() => set("billingType", "AZIENDE")}
              className={`h-10 rounded-xl border px-4 text-sm font-extrabold ${
                form.billingType === "AZIENDE" ? "border-text bg-surface" : "border-border bg-background hover:bg-surface-2"
              }`}
            >
              Azienda
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background p-4">
          <div className="text-sm font-extrabold">Contatti</div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              placeholder="Nome"
              className="h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-text"
            />
            <input
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              placeholder="Cognome"
              className="h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-text"
            />
            <input
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="Email"
              className="h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-text sm:col-span-2"
            />
            <input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="Telefono"
              className="h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-text"
            />
            <input
              value={form.fiscalCode}
              onChange={(e) => set("fiscalCode", e.target.value)}
              placeholder="Codice fiscale (opz.)"
              className="h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-text"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background p-4">
          <div className="text-sm font-extrabold">Indirizzo</div>

          <div className="mt-3 grid gap-3">
            <input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Indirizzo"
              className="h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-text"
            />

            <div className="grid gap-3 sm:grid-cols-3">
              <input
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="Città"
                className="h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-text sm:col-span-1"
              />
              <input
                value={form.postalCode}
                onChange={(e) => set("postalCode", e.target.value)}
                placeholder="CAP"
                className="h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-text"
              />
              <input
                value={form.province}
                onChange={(e) => set("province", e.target.value)}
                placeholder="Provincia"
                className="h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-text"
              />
            </div>
          </div>
        </div>

        {isCompany ? (
          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="text-sm font-extrabold">Dati azienda</div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                value={form.companyName}
                onChange={(e) => set("companyName", e.target.value)}
                placeholder="Ragione sociale *"
                className="h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-text sm:col-span-2"
              />
              <input
                value={form.vatNumber}
                onChange={(e) => set("vatNumber", e.target.value)}
                placeholder="Partita IVA *"
                className="h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-text"
              />
              <input
                value={form.sdi}
                onChange={(e) => set("sdi", e.target.value)}
                placeholder="SDI (opz.)"
                className="h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-text"
              />
              <input
                value={form.pec}
                onChange={(e) => set("pec", e.target.value)}
                placeholder="PEC (opz.)"
                className="h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-text sm:col-span-2"
              />
            </div>
          </div>
        ) : null}

        {err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm">
            <div className="font-extrabold text-red-700">❌ {err}</div>
          </div>
        ) : null}

        {msg ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm">
            <div className="font-extrabold text-green-700">✅ {msg}</div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover disabled:opacity-60"
          >
            {saving ? "Salvataggio…" : "Salva"}
          </button>

          <Link
            href="/carrello"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background px-5 text-sm font-extrabold hover:bg-surface-2"
          >
            Vai al carrello
          </Link>
        </div>
      </div>
    </main>
  );
}
