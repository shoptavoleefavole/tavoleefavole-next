"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Address = {
  id: string;
  label?: string; // es: "Casa", "Lavoro"
  fullName: string;
  phone?: string;
  street: string;
  cap: string;
  city: string;
  province?: string;
  country: string;
  isDefault?: boolean;
};

const STORAGE_KEY = "tf_addresses_v1";

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function safeParse(raw: string | null): Address[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => (x && typeof x === "object" ? x : null))
      .filter(Boolean) as Address[];
  } catch {
    return [];
  }
}

function normalize(a: Partial<Address>): Address {
  return {
    id: String(a.id || uid()),
    label: (a.label || "").trim() || undefined,
    fullName: String(a.fullName || "").trim(),
    phone: (a.phone || "").trim() || undefined,
    street: String(a.street || "").trim(),
    cap: String(a.cap || "").trim(),
    city: String(a.city || "").trim(),
    province: (a.province || "").trim() || undefined,
    country: String(a.country || "Italia").trim() || "Italia",
    isDefault: Boolean(a.isDefault),
  };
}

function validate(a: Address): string | null {
  if (!a.fullName) return "Inserisci Nome e Cognome.";
  if (!a.street) return "Inserisci Indirizzo (via/piazza e numero).";
  if (!a.cap) return "Inserisci CAP.";
  if (!a.city) return "Inserisci Città.";
  if (!a.country) return "Inserisci Nazione.";
  return null;
}

export default function AccountAddressesPage() {
  const [items, setItems] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<Partial<Address>>({
    label: "",
    fullName: "",
    phone: "",
    street: "",
    cap: "",
    city: "",
    province: "",
    country: "Italia",
  });

  // load
  useEffect(() => {
    if (typeof window === "undefined") return;
    const arr = safeParse(window.localStorage.getItem(STORAGE_KEY));
    setItems(arr);
    setLoading(false);
  }, []);

  // persist
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (loading) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items, loading]);

  const sorted = useMemo(() => {
    const def = items.find((x) => x.isDefault);
    const rest = items.filter((x) => !x.isDefault);
    return def ? [def, ...rest] : rest;
  }, [items]);

  function openCreate() {
    setEditingId(null);
    setForm({
      label: "",
      fullName: "",
      phone: "",
      street: "",
      cap: "",
      city: "",
      province: "",
      country: "Italia",
    });
    setError(null);
    setIsFormOpen(true);
  }

  function openEdit(id: string) {
    const found = items.find((x) => x.id === id);
    if (!found) return;
    setEditingId(id);
    setForm(found);
    setError(null);
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingId(null);
    setError(null);
  }

  function save() {
    const next = normalize({ ...form, id: editingId || undefined });

    const msg = validate(next);
    if (msg) {
      setError(msg);
      return;
    }

    setItems((prev) => {
      const exists = prev.some((x) => x.id === next.id);
      let out = exists ? prev.map((x) => (x.id === next.id ? { ...x, ...next } : x)) : [...prev, next];

      // se è il primo indirizzo => default automatico
      if (out.length === 1) out = out.map((x) => ({ ...x, isDefault: true }));

      // se l’utente ha spuntato default in edit => un solo default
      if (next.isDefault) out = out.map((x) => ({ ...x, isDefault: x.id === next.id }));

      return out;
    });

    closeForm();
  }

  function remove(id: string) {
    setItems((prev) => {
      const wasDefault = prev.find((x) => x.id === id)?.isDefault;
      const out = prev.filter((x) => x.id !== id);

      // se ho rimosso il default => promuovo il primo rimasto
      if (wasDefault && out.length) {
        out[0] = { ...out[0], isDefault: true };
      }
      return out;
    });
  }

  function setDefault(id: string) {
    setItems((prev) => prev.map((x) => ({ ...x, isDefault: x.id === id })));
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">I miei indirizzi</h1>
          <p className="mt-1 text-sm text-text/70">
            Gestisci gli indirizzi per spedizioni e fatturazione.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="h-11 rounded-xl border border-border bg-background px-4 text-sm font-extrabold hover:bg-surface-2"
        >
          + Aggiungi
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-surface p-4 text-sm text-text/70">
        Nota: per ora gli indirizzi sono salvati nel browser (localStorage). Nel prossimo step li salviamo su Strapi e li useremo nel checkout.
      </div>

      {loading ? (
        <div className="mt-6 text-sm text-text/70">Caricamento…</div>
      ) : sorted.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-border bg-background p-6">
          <div className="text-sm text-text/70">Nessun indirizzo salvato.</div>
          <button
            type="button"
            onClick={openCreate}
            className="mt-4 h-11 rounded-xl border border-border bg-background px-4 text-sm font-extrabold hover:bg-surface-2"
          >
            Aggiungi il primo indirizzo
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {sorted.map((a) => (
            <div key={a.id} className="rounded-2xl border border-border bg-background p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-extrabold">{a.label || "Indirizzo"}</div>
                    {a.isDefault ? (
                      <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold">
                        Predefinito
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2 text-sm">
                    <div className="font-semibold">{a.fullName}</div>
                    <div className="text-text/70">
                      {a.street}
                      <br />
                      {a.cap} {a.city}
                      {a.province ? ` (${a.province})` : ""}
                      <br />
                      {a.country}
                      {a.phone ? (
                        <>
                          <br />
                          Tel: {a.phone}
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {!a.isDefault ? (
                    <button
                      type="button"
                      onClick={() => setDefault(a.id)}
                      className="h-10 rounded-xl border border-border bg-background px-3 text-xs font-extrabold hover:bg-surface-2"
                    >
                      Imposta default
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => openEdit(a.id)}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-xs font-extrabold hover:bg-surface-2"
                  >
                    Modifica
                  </button>

                  <button
                    type="button"
                    onClick={() => remove(a.id)}
                    className="h-10 rounded-xl border border-red-200 bg-background px-3 text-xs font-extrabold text-red-600 hover:bg-red-50"
                  >
                    Elimina
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* mini footer */}
      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Link href="/account" className="text-sm font-semibold text-link hover:text-link-hover">
          ← Torna all’account
        </Link>
      </div>

      {/* FORM */}
      {isFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 md:items-center">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-background p-5 shadow">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-extrabold">
                  {editingId ? "Modifica indirizzo" : "Nuovo indirizzo"}
                </div>
                <div className="mt-1 text-sm text-text/70">
                  Compila i dati. I campi principali sono obbligatori.
                </div>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-extrabold hover:bg-surface-2"
              >
                Chiudi
              </button>
            </div>

            {error ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="mt-4 grid gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-text/70">Etichetta (opzionale)</span>
                  <input
                    value={form.label ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                    className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                    placeholder="Casa, Lavoro…"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-text/70">Telefono (opzionale)</span>
                  <input
                    value={form.phone ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                    placeholder="+39…"
                  />
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-text/70">Nome e Cognome *</span>
                <input
                  value={form.fullName ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                  className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                  placeholder="Mario Rossi"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-text/70">Indirizzo (via/piazza + numero) *</span>
                <input
                  value={form.street ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, street: e.target.value }))}
                  className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                  placeholder="Via Roma 10"
                />
              </label>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-text/70">CAP *</span>
                  <input
                    value={form.cap ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, cap: e.target.value }))}
                    className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                    placeholder="00100"
                  />
                </label>

                <label className="grid gap-1 md:col-span-2">
                  <span className="text-xs font-semibold text-text/70">Città *</span>
                  <input
                    value={form.city ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                    className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                    placeholder="Roma"
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-text/70">Provincia (opzionale)</span>
                  <input
                    value={form.province ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, province: e.target.value }))}
                    className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                    placeholder="RM"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-text/70">Nazione *</span>
                  <input
                    value={form.country ?? "Italia"}
                    onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
                    className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                    placeholder="Italia"
                  />
                </label>
              </div>

              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(form.isDefault)}
                  onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))}
                />
                Imposta come predefinito
              </label>

              <div className="mt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="h-11 rounded-xl border border-border bg-background px-4 text-sm font-extrabold hover:bg-surface-2"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={save}
                  className="h-11 rounded-xl border border-border bg-background px-4 text-sm font-extrabold hover:bg-surface-2"
                >
                  Salva
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
