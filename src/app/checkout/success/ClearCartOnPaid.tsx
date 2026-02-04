"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";

type ConfirmOk = {
  ok: true;
  paid: boolean;
  orderRef?: string | null;
  orderId?: string | null;
  updated?: boolean;
  payment_status?: string | null;
  status?: string | null;
};

type ConfirmErr = {
  ok?: false;
  error: string;
  status?: number;
  details?: any;
};

type ConfirmResponse = ConfirmOk | ConfirmErr;

function isOk(x: any): x is ConfirmOk {
  return x && typeof x === "object" && x.ok === true && typeof x.paid === "boolean";
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * ClearCartOnPaid
 * - Controlla /api/checkout/confirm?session_id=...
 * - Se paid=true:
 *   1) chiama cart.clear() (svuota stato + storage della key corrente)
 *   2) pulisce chiavi legacy e la key nuova tf_cart_v2 (difesa extra)
 *   3) salva flag in sessionStorage per evitare doppie esecuzioni
 *
 * In produzione non renderizza nulla.
 */
export default function ClearCartOnPaid({ sessionId }: { sessionId: string }) {
  // useCart in teoria non dovrebbe mai essere null: se manca Provider lancia errore.
  // Quindi NON facciamo cast a any: restiamo tipati e “sicuri”.
  const cart = useCart();

  // clear è la funzione standard del tuo CartProvider
  const clearFn = useMemo<(() => void)>(() => {
    return cart.clear;
  }, [cart.clear]);

  const processedRef = useRef<Set<string>>(new Set());

  const [status, setStatus] = useState<
    "idle" | "checking" | "paid" | "not_paid" | "error" | "missing"
  >("idle");

  useEffect(() => {
    const sid = String(sessionId ?? "").trim();
    if (!sid) {
      setStatus("missing");
      return;
    }

    // StrictMode guard (dev): in dev React può montare/smontare due volte
    if (processedRef.current.has(sid)) return;
    processedRef.current.add(sid);

    const sessionFlagKey = `tf_cart_cleared_${sid}`;

    // Se già pulito in questa sessione/tab, non rifare tutto
    try {
      if (typeof window !== "undefined" && window.sessionStorage.getItem(sessionFlagKey) === "1") {
        setStatus("paid");
        return;
      }
    } catch {
      // ignore
    }

    let cancelled = false;
    const controller = new AbortController();

    async function run() {
      setStatus("checking");

      // tentativi ravvicinati: Stripe/confirm può arrivare leggermente dopo il redirect
      const delays = [0, 500, 900, 1400, 2000, 2600];
      const MAX_TRIES = delays.length;

      for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
        if (cancelled) return;

        try {
          const d = delays[attempt - 1];
          if (d) {
            await sleep(d);
            if (cancelled) return;
          }

          const res = await fetch(`/api/checkout/confirm?session_id=${encodeURIComponent(sid)}`, {
            method: "GET",
            cache: "no-store",
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });

          const json = (await res.json().catch(() => null)) as ConfirmResponse | null;

          if (cancelled) return;

          if (!res.ok || !json) {
            // ritenta fino a MAX_TRIES
            if (attempt < MAX_TRIES) continue;
            setStatus("error");
            return;
          }

          if (isOk(json) && json.paid === true) {
            // ✅ Pagato: pulizia totale (stato + storage)
            try {
              // 1) svuota stato e la key corrente del CartProvider
              clearFn();

              // 2) pulizia difensiva: vecchie chiavi + nuova chiave
              try {
                ["tf_cart_v1", "tf_cart", "cart", "tf_cart_v2"].forEach((k) => {
                  try {
                    window.localStorage.removeItem(k);
                  } catch {
                    // ignore singola key
                  }
                });
              } catch {
                // ignore
              }

              // 3) flag in sessionStorage per evitare doppia pulizia
              try {
                window.sessionStorage.setItem(sessionFlagKey, "1");
              } catch {
                // ignore
              }
            } catch {
              // non bloccare: anche se qualcosa va storto, non fermiamo la pagina
            }

            setStatus("paid");
            return;
          }

          // non ancora pagato
          if (attempt < MAX_TRIES) continue;

          setStatus("not_paid");
          return;
        } catch (e: any) {
          if (cancelled) return;
          if (e?.name === "AbortError") return;

          if (attempt < MAX_TRIES) continue;
          setStatus("error");
          return;
        }
      }
    }

    run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [sessionId, clearFn]);

  // In produzione: non mostrare nulla
  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="mt-4 rounded-2xl border border-border bg-surface p-4 text-sm">
      <div className="font-extrabold">Debug carrello</div>
      <div className="mt-1 text-text/70">
        Stato:{" "}
        {status === "idle"
          ? "idle"
          : status === "checking"
          ? "verifica pagamento…"
          : status === "paid"
          ? "pagato → carrello svuotato ✅"
          : status === "not_paid"
          ? "non ancora pagato"
          : status === "missing"
          ? "sessionId mancante"
          : "errore confirm"}
      </div>
    </div>
  );
}
