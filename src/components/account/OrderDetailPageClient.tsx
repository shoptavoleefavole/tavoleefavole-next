"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type OrderItem = {
  id?: string | null;
  name?: string | null;
  qty?: number | null;
  price?: number | null;
};

type OrderDetail = {
  id: number | string | null;
  documentId: string | null;
  orderStatus: string | null;
  total: number | null;
  currency: string | null;
  createdAt: string | null;
  stripeSessionId: string | null;

  items?: OrderItem[] | null;
  subtotal?: number | null;
  shipping?: number | null;
  discount?: number | null;

  shippingTotal?: number | null;
  discountTotal?: number | null;
};

type ApiOk = { ok: true; order: OrderDetail };
type ApiErr = { ok?: false; error?: string; details?: any; status?: number };

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function fmtDate(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "-";
  return d.toLocaleString("it-IT");
}

function fmtMoney(total: number | null, currency: string | null) {
  if (typeof total !== "number" || !Number.isFinite(total)) return "-";
  const cur = (currency || "EUR").toUpperCase();
  return `${total.toFixed(2)} ${cur}`;
}

function statusLabel(raw: string | null) {
  const s = String(raw || "").toUpperCase();
  if (s === "PAID") return "Pagato";
  if (s === "PENDING_PAYMENT") return "In attesa pagamento";
  if (s === "CANCELED" || s === "CANCELLED") return "Annullato";
  if (s === "REFUNDED") return "Rimborsato";
  return s || "-";
}

function isNumericRef(ref: string) {
  return /^\d+$/.test(ref);
}

export default function OrderDetailPageClient({ documentId }: { documentId: string }) {
  const ref = useMemo(() => String(documentId || "").trim(), [documentId]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [order, setOrder] = useState<OrderDetail | null>(null);

  useEffect(() => {
    if (!ref) {
      setLoading(false);
      setErr("Riferimento ordine mancante.");
      return;
    }

    const controller = new AbortController();

    async function run() {
      setLoading(true);
      setErr("");
      setOrder(null);

      // ✅ se ref è numerico -> usa ?id=...
      const url = isNumericRef(ref)
        ? `/api/account/orders?id=${encodeURIComponent(ref)}`
        : `/api/account/orders?documentId=${encodeURIComponent(ref)}`;

      try {
        const res = await fetch(url, {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });

        const text = await res.text().catch(() => "");
        const json = safeJsonParse(text) as ApiOk | ApiErr | null;

        if (!res.ok || !json || (json as ApiOk).ok !== true) {
          const msg = (json as ApiErr)?.error || `Errore (HTTP ${res.status})`;
          setErr(String(msg));
          setLoading(false);
          return;
        }

        setOrder((json as ApiOk).order);
        setLoading(false);
      } catch (e: any) {
        if (controller.signal.aborted) return;
        setErr(e?.message || "Errore di rete");
        setLoading(false);
      }
    }

    run();
    return () => controller.abort();
  }, [ref]);

  const currency = order?.currency || "EUR";
  const items = Array.isArray(order?.items) ? order!.items! : [];

  const subtotal = order?.subtotal ?? null;
  const shipping = (order?.shippingTotal ?? order?.shipping ?? null) as number | null;
  const discount = (order?.discountTotal ?? order?.discount ?? null) as number | null;

  const shownRef = order?.documentId || String(order?.id || ref);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 pb-24 md:pb-10">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Dettagli ordine</h1>
        <Link href="/account/ordini" className="text-sm font-extrabold hover:underline">
          ← I miei ordini
        </Link>
      </div>

      <div className="mt-2 break-all text-sm text-text/60">
        Riferimento: <span className="font-extrabold text-text">{shownRef}</span>
      </div>

      {loading ? (
        <div className="mt-6 rounded-2xl border border-border bg-background p-4 text-sm text-text/70">
          Caricamento…
        </div>
      ) : null}

      {!loading && err ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm">
          <div className="font-extrabold text-red-700">❌ {err}</div>
        </div>
      ) : null}

      {!loading && !err && order ? (
        <div className="mt-6 grid gap-3">
          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold">Stato</div>
                <div className="mt-1 text-sm text-text/70">{statusLabel(order.orderStatus)}</div>
                <div className="mt-3 text-xs text-text/50">
                  Data: <span className="text-text/70">{fmtDate(order.createdAt)}</span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-extrabold">Totale</div>
                <div className="mt-1 text-lg font-extrabold">{fmtMoney(order.total, currency)}</div>
              </div>
            </div>

            {String(order.orderStatus || "").toUpperCase() === "PENDING_PAYMENT" && order.stripeSessionId ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Pagamento in verifica: se hai appena pagato, il sistema può impiegare qualche secondo per aggiornare lo stato.
              </div>
            ) : null}

            {order.stripeSessionId ? (
              <div className="mt-3 break-all text-xs text-text/50">Stripe session: {order.stripeSessionId}</div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="text-sm font-extrabold">Riepilogo</div>

            <div className="mt-3 grid gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-text/70">Subtotale</span>
                <span className="font-extrabold">{fmtMoney(subtotal, currency)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-text/70">Spedizione</span>
                <span className="font-extrabold">{shipping == null ? "-" : fmtMoney(shipping, currency)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-text/70">Sconto</span>
                <span className="font-extrabold">{discount == null ? "-" : `- ${fmtMoney(discount, currency)}`}</span>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-text/70">Totale</span>
                <span className="text-base font-extrabold">{fmtMoney(order.total, currency)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="text-sm font-extrabold">Articoli</div>

            {items.length === 0 ? (
              <div className="mt-3 text-sm text-text/70">Nessun articolo disponibile.</div>
            ) : (
              <ul className="mt-3 grid gap-2">
                {items.map((it, idx) => {
                  const name = String(it?.name || "Articolo").trim();
                  const qty = typeof it?.qty === "number" && Number.isFinite(it.qty) ? it.qty : 1;
                  const price = typeof it?.price === "number" && Number.isFinite(it.price) ? it.price : null;

                  return (
                    <li key={String(it?.id || idx)} className="rounded-xl border border-border bg-surface p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-extrabold">{name}</div>
                        <div className="text-sm font-extrabold">
                          {price == null ? "-" : fmtMoney(price * qty, currency)}
                        </div>
                      </div>

                      <div className="mt-1 text-xs text-text/60">
                        Quantità: <b className="text-text">{qty}</b>
                        {price != null ? (
                          <>
                            {" "}
                            — Prezzo unitario: <b className="text-text">{fmtMoney(price, currency)}</b>
                          </>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/account/ordini"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background px-5 text-sm font-extrabold hover:bg-surface-2"
            >
              Torna agli ordini
            </Link>
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover"
            >
              Continua lo shopping
            </Link>
          </div>
        </div>
      ) : null}
    </main>
  );
}
