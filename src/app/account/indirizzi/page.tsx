"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Address = {
  address: string;
  city: string;
  postalCode: string;
  province: string;
  country: string; // IT
};

function capOk(cap: string) {
  const c = String(cap || "").replace(/\s+/g, "");
  return /^\d{5}$/.test(c);
}

function validate(a: Address): string | null {
  if (!a.address.trim() || a.address.trim().length < 3) return "Inserisci Indirizzo (via/piazza e numero).";
  if (!a.city.trim() || a.city.trim().length < 2) return "Inserisci Città.";
  if (!capOk(a.postalCode)) return "Inserisci CAP valido (5 cifre).";
  if (!a.province.trim() || a.province.trim().length < 2) return "Inserisci Provincia (es. MI oppure Milano).";
  return null;
}

function normalize(input: any): Address {
  const a = input && typeof input === "object" ? input : {};
  return {
    address: String(a.address ?? "").trim(),
    city: String(a.city ?? "").trim(),
    postalCode: String(a.postalCode ?? "").trim().replace(/\s+/g, ""),
    province: String(a.province ?? "").trim(),
    country: String(a.country ?? "IT").trim().toUpperCase() || "IT",
  };
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, credentials: "include" });
  const data = await res.json().catch(() => null);
  return { res, data };
}

export default function AccountIndirizziPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState<Address>({
    address: "",
    city: "",
    postalCode: "",
    province: "",
    country: "IT",
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErr(null);
      setMsg(null);

      const { res, data } = await fetchJson("/api/profile/shipping-address", { method: "GET" });
      if (cancelled) return;

      if (!res.ok || !data?.ok) {
        setErr("Impossibile caricare l’indirizzo di spedizione.");
        setLoading(false);
        return;
      }

      const a = data?.address ? normalize(data.address) : null;
      if (a) setForm(a);

      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setErr(null);
    setMsg(null);

    const next = normalize(form);
    const v = validate(next);
    if (v) {
      setErr(v);
      return;
    }

    try {
      setSaving(true);

      const { res, data } = await fetchJson("/api/profile/shipping-address", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });

      if (!res.ok || !data?.ok) {
        const status = typeof data?.status === "number" ? ` (status ${data.status})` : "";
        setErr(`Salvataggio non riuscito${status}.`);
        return;
      }

      setMsg("Indirizzo salvato correttamente ✅");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Indirizzi</h1>
          <p className="mt-1 text-sm text-text/70">
            L’indirizzo di spedizione viene usato nel carrello per calcolare la spedizione.
          </p>
        </div>

        <Link href="/account" className="text-sm font-semibold text-link hover:text-link-hover">
          ← Torna all’account
        </Link>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-background p-5">
        <div className="text-sm font-extrabold">Indirizzo di spedizione</div>

        {loading ? (
          <div className="mt-3 text-sm text-text/70">Caricamento…</div>
        ) : (
          <div className="mt-4 grid gap-3">
            {err ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>
            ) : null}
            {msg ? (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                {msg}
              </div>
            ) : null}

            <label className="grid gap-1">
              <span className="text-xs font-semibold text-text/70">Indirizzo *</span>
              <input
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                placeholder="Via Roma 10"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-text/70">Città *</span>
                <input
                  value={form.city}
                  onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                  className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                  placeholder="Milano"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-text/70">Provincia *</span>
                <input
                  value={form.province}
                  onChange={(e) => setForm((p) => ({ ...p, province: e.target.value }))}
                  className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                  placeholder="MI oppure Milano"
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-text/70">CAP *</span>
                <input
                  value={form.postalCode}
                  onChange={(e) => setForm((p) => ({ ...p, postalCode: e.target.value }))}
                  className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                  placeholder="20100"
                  inputMode="numeric"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-text/70">Paese</span>
                <input value="Italia" readOnly className="h-11 rounded-xl border border-border bg-background px-3 text-sm" />
              </label>
            </div>

            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="h-11 rounded-xl border border-border bg-background px-4 text-sm font-extrabold hover:bg-surface-2 disabled:opacity-60"
              >
                {saving ? "Salvo…" : "Salva"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}