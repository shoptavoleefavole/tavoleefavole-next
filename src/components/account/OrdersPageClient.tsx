"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Order = {
  id: number | string | null;
  documentId: string | null;
  orderStatus: string | null;
  total: number | null;
  currency: string | null;
  createdAt: string | null;
  stripeSessionId: string | null;
};

type ApiOk = { ok: true; orders: Order[] };
type ApiErr = { ok?: false; error?: string; details?: any; status?: number };
type ApiResp = ApiOk | ApiErr;

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function safeArray<T>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString("it-IT");
}

function fmtMoney(total: number | null, currency: string | null) {
  if (typeof total !== "number" || !Number.isFinite(total)) return "—";
  const cur = (currency || "EUR").toUpperCase();
  return `${total.toFixed(2)} ${cur}`;
}

function statusLabel(raw: string | null) {
  const s = String(raw || "").toUpperCase();
  if (s === "PAID") return "Pagato";
  if (s === "PENDING_PAYMENT") return "In attesa pagamento";
  if (s === "CANCELED" || s === "CANCELLED") return "Annullato";
  if (s === "REFUNDED") return "Rimborsato";
  return s || "—";
}

function orderRef(o: Order) {
  const ref = String(o.documentId || o.id || "").trim();
  return ref || "";
}

export default function OrdersPageClient() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      setLoading(true);
      setErr("");
      setHttpStatus(null);

      try {
        const res = await fetch("/api/account/orders", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });

        setHttpStatus(res.status);

        const text = await res.text().catch(() => "");
        const json = safeJsonParse(text) as ApiResp | null;

        if (!res.ok || !json || (json as ApiOk).ok !== true) {
          const msg =
            (json as ApiErr)?.error ||
            (res.status === 401 ? "Non sei loggato" : `Errore (HTTP ${res.status})`);
          setErr(String(msg));
          setOrders([]);
          setLoading(false);
          return;
        }

        const list = safeArray<Order>((json as ApiOk).orders);
        setOrders(list);
        setLoading(false);
      } catch (e: any) {
        if (controller.signal.aborted) return;
        setErr(e?.message || "Errore di rete");
        setOrders([]);
        setLoading(false);
      }
    }

    run();
    return () => controller.abort();
  }, []);

  const sorted = useMemo(() => {
    return [...orders].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  }, [orders]);

  const showLoginHint = httpStatus === 401;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 pb-24 md:pb-10">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-2xl font-extrabold sm:text-3xl">I miei ordini</h1>
        <Link href="/account" className="text-sm font-extrabold hover:underline">
          ← Account
        </Link>
      </div>

      {loading ? (
        <div className="mt-6 rounded-2xl border border-border bg-background p-4 text-sm text-text/70">
          Caricamento…
        </div>
      ) : null}

      {!loading && err ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm">
          <div className="font-extrabold text-red-700">❌ {err}</div>

          {showLoginHint ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/accedi?next=/account/ordini"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-extrabold hover:bg-surface"
              >
                Vai ad accedi
              </Link>
              <Link
                href="/"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-extrabold hover:bg-surface"
              >
                Torna alla home
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && !err && sorted.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-background p-4 text-sm text-text/70">
          Nessun ordine trovato.
        </div>
      ) : null}

      {!loading && !err && sorted.length > 0 ? (
        <div className="mt-6 grid gap-3">
          {sorted.map((o) => {
            const ref = orderRef(o);
            const href = ref ? `/account/ordini/${encodeURIComponent(ref)}` : null;

            return (
              <div key={String(ref || Math.random())} className="rounded-2xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-extrabold">
                      Ordine: <span className="break-all">{ref || "—"}</span>
                    </div>
                    <div className="mt-1 text-xs text-text/60">{fmtDate(o.createdAt)}</div>
                    <div className="mt-2 text-xs text-text/60">
                      Stato: <span className="font-extrabold text-text">{statusLabel(o.orderStatus)}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-extrabold">Totale</div>
                    <div className="mt-1 text-lg font-extrabold">{fmtMoney(o.total, o.currency)}</div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {href ? (
                    <Link
                      href={href}
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover"
                    >
                      Vedi dettagli
                    </Link>
                  ) : (
                    <span className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-extrabold text-text/60">
                      Dettagli non disponibili
                    </span>
                  )}

                  <Link
                    href="/"
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-extrabold hover:bg-surface-2"
                  >
                    Torna alla home
                  </Link>

                  <Link
                    href="/carrello"
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-extrabold hover:bg-surface-2"
                  >
                    Vai al carrello
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </main>
  );
}
