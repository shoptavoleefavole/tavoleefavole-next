"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

type AccountType = "PERSON" | "BUSINESS";

type ProfileDTO = {
  ok: boolean;
  type: AccountType;
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  vatNumber: string;
  sdi: string;
  pec: string;
};

function clamp(v: unknown, max = 140) {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max) : s;
}

function isValidEmail(email: string) {
  if (!email || email.length > 254) return false;
  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@")) return false;
  const domain = email.slice(at + 1);
  if (!domain || !domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) return false;
  if (/\s/.test(email)) return false;
  return true;
}

export default function ProfilePageClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [type, setType] = useState<AccountType>("PERSON");
  const [email, setEmail] = useState("");

  // PERSON
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // BUSINESS
  const [companyName, setCompanyName] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [sdi, setSdi] = useState("");
  const [pec, setPec] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const displayTitle = useMemo(() => {
    if (type === "BUSINESS") return "Dati aziendali";
    return "Dati profilo";
  }, [type]);

  async function load() {
    setError(null);
    setOkMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const json = (await res.json().catch(() => null)) as ProfileDTO | null;
      if (!res.ok || !json?.ok) {
        setError("Non riesco a caricare il profilo. Riprova tra poco.");
        return;
      }

      setType(json.type);
      setEmail(String(json.email ?? ""));

      setFirstName(String(json.firstName ?? ""));
      setLastName(String(json.lastName ?? ""));

      setCompanyName(String(json.companyName ?? ""));
      setVatNumber(String(json.vatNumber ?? ""));
      setSdi(String(json.sdi ?? ""));
      setPec(String(json.pec ?? ""));
    } catch {
      setError("Errore di rete. Riprova tra poco.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);

    const e1 = email.trim().toLowerCase();
    if (!isValidEmail(e1)) {
      setError("Email non valida.");
      return;
    }

    const fn = clamp(firstName, 60);
    const ln = clamp(lastName, 60);

    const cn = clamp(companyName, 140);
    const vat = clamp(vatNumber, 40);
    const sdi1 = clamp(sdi, 20);
    const pec1 = clamp(pec, 120);

    if (type === "BUSINESS" && !cn) {
      setError("Inserisci la ragione sociale.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PUT",
        cache: "no-store",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          type,
          email: e1, // per ora è solo informativo; viene validato lato server
          firstName: fn,
          lastName: ln,
          companyName: cn,
          vatNumber: vat,
          sdi: sdi1,
          pec: pec1,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError("Salvataggio non riuscito. Controlla i dati e riprova.");
        return;
      }

      setOkMsg("Profilo aggiornato correttamente.");
      // ricarica per riallineare stato con server
      await load();
    } catch {
      setError("Errore di rete. Riprova tra poco.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold">{displayTitle}</h1>
          <p className="text-sm text-text/70">Aggiorna i tuoi dati per velocizzare ordini e comunicazioni.</p>
        </div>

        {loading ? (
          <div className="mt-6 rounded-xl border border-border bg-surface p-4 text-sm">Caricamento profilo…</div>
        ) : (
          <>
            {error ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            ) : null}
            {okMsg ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{okMsg}</div>
            ) : null}

            <form onSubmit={onSubmit} className="mt-6 space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-sm font-semibold text-text">Email</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    inputMode="email"
                    className="mt-1 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="mt-1 text-xs text-text/60">
                    L’email viene mostrata a scopo informativo. (Se vuoi cambiare email in sicurezza, lo facciamo con un flusso dedicato.)
                  </div>
                </div>

                {type === "PERSON" ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <div className="sm:col-span-2">
                      <label className="text-sm font-semibold text-text">Ragione sociale *</label>
                      <input
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="mt-1 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-text">P.IVA</label>
                      <input
                        value={vatNumber}
                        onChange={(e) => setVatNumber(e.target.value)}
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

                    <div className="sm:col-span-2">
                      <label className="text-sm font-semibold text-text">PEC</label>
                      <input
                        value={pec}
                        onChange={(e) => setPec(e.target.value)}
                        className="mt-1 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                        placeholder="es. pec@azienda.it"
                      />
                    </div>
                  </>
                )}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary text-primary-contrast text-sm font-extrabold hover:bg-primary-hover disabled:opacity-60"
              >
                {saving ? "Salvataggio…" : "Salva modifiche"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
