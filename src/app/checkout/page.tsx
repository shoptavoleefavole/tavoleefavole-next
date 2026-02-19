"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";

type Address = {
  id: string;
  label?: string;
  fullName: string;
  phone?: string;
  street: string;
  cap: string;
  city: string;
  province?: string;
  country: string;
  isDefault?: boolean;
};

const ADDR_KEY = "tf_addresses_v1";

function safeParse(raw: string | null): Address[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as Address[]) : [];
  } catch {
    return [];
  }
}

function money(n: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "€ 0,00";
  return `€ ${x.toFixed(2)}`;
}

export default function CheckoutPage() {
  const { items, summary } = useCart();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const arr = safeParse(typeof window !== "undefined" ? window.localStorage.getItem(ADDR_KEY) : null);
    setAddresses(arr);

    const def = arr.find((a) => a.isDefault);
    if (def?.id) setSelectedId(def.id);
    else if (arr[0]?.id) setSelectedId(arr[0].id);
  }, []);

  const selected = useMemo(
    () => addresses.find((a) => a.id === selectedId) || null,
    [addresses, selectedId]
  );

  const canPay = items.length > 0 && summary.total > 0;

  async function goPay() {
    setErr(null);
    if (!canPay) return;

    setLoading(true);
    try {
      const payload = {
        items: items.map((x) => ({ id: x.id, slug: x.slug, qty: x.qty })),
        address: selected,
        email: email.trim() || undefined,
      };

      const res = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErr(data?.error || "Errore checkout");
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      setErr("URL di pagamento non ricevuto");
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Checkout</h1>
          <p className="mt-1 text-sm text-text/70">Conferma indirizzo e procedi al pagamento.</p>
        </div>
        <Link href="/carrello" className="text-sm font-semibold text-link hover:text-link-hover">
          ← Torna al carrello
        </Link>
      </div>

      {err ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-border bg-background p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-extrabold">Indirizzo di spedizione</div>
              <Link
                href="/account/indirizzi"
                className="text-sm font-semibold text-link hover:text-link-hover"
              >
                Gestisci indirizzi
              </Link>
            </div>

            {addresses.length === 0 ? (
              <div className="mt-3 text-sm text-text/70">
                Nessun indirizzo salvato. Vai su{" "}
                <Link href="/account/indirizzi" className="font-semibold text-link hover:text-link-hover">
                  /account/indirizzi
                </Link>{" "}
                e aggiungine uno.
              </div>
            ) : (
              <div className="mt-4 grid gap-3">
                {addresses.map((a) => (
                  <label
                    key={a.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${
                      selectedId === a.id ? "border-border" : "border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      name="addr"
                      className="mt-1"
                      checked={selectedId === a.id}
                      onChange={() => setSelectedId(a.id)}
                    />
                    <div className="text-sm">
                      <div className="font-extrabold">{a.label || "Indirizzo"}</div>
                      <div className="mt-1 text-text/70">
                        <div className="font-semibold text-text">{a.fullName}</div>
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
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-background p-5">
            <div className="text-sm font-extrabold">Email (opzionale)</div>
            <p className="mt-1 text-sm text-text/70">
              Se inserisci l’email, Stripe può inviare ricevuta e aggiornamenti.
            </p>

            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@email.it"
              className="mt-3 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            />
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-border bg-background p-5 lg:sticky lg:top-24">
            <div className="text-sm font-extrabold">Riepilogo</div>

            <div className="mt-3 grid gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-text/70">Prodotti</span>
                <span className="font-semibold">{summary.count}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-text/70">Totale</span>
                <span className="text-lg font-extrabold">{money(summary.total)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={goPay}
              disabled={!canPay || loading || (addresses.length > 0 && !selected)}
              className="mt-4 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm font-extrabold hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Apro Stripe…" : "Paga con Stripe"}
            </button>

            <div className="mt-3 text-xs text-text/60">
              Verifichiamo prezzi e disponibilità lato server prima di creare la sessione.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
