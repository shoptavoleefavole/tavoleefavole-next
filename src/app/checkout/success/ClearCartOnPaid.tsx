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

export default function ClearCartOnPaid({ sessionId }: { sessionId: string }) {
  const cart = useCart() as any;

  const clearFn = useMemo<(() => void) | null>(() => {
    if (!cart) return null;
    if (typeof cart.clear === "function") return cart.clear.bind(cart);
    if (typeof cart.clearCart === "function") return cart.clearCart.bind(cart);
    if (typeof cart.reset === "function") return cart.reset.bind(cart);
    return null;
  }, [cart]);

  const processedRef = useRef<Set<string>>(new Set());

  const [status, setStatus] = useState<
    "idle" | "checking" | "paid" | "not_paid" | "error" | "no_clear" | "missing"
  >("idle");

  useEffect(() => {
    const sid = String(sessionId ?? "").trim();
    if (!sid) {
      setStatus("missing");
      return;
    }

    if (!clearFn) {
      setStatus("no_clear");
      return;
    }

    // StrictMode guard (dev)
    if (processedRef.current.has(sid)) return;
    processedRef.current.add(sid);

    const key = `tf_cart_cleared_${sid}`;

    try {
      if (typeof window !== "undefined" && window.sessionStorage.getItem(key) === "1") {
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

          const res = await fetch(
            `/api/checkout/confirm?session_id=${encodeURIComponent(sid)}`,
            {
              method: "GET",
              cache: "no-store",
              headers: { Accept: "application/json" },
              signal: controller.signal,
            }
          );

          const json = (await res.json().catch(() => null)) as ConfirmResponse | null;

          if (cancelled) return;

          if (!res.ok || !json) {
            if (attempt < MAX_TRIES) continue;
            setStatus("error");
            return;
          }

          if (isOk(json) && json.paid === true) {
            // ✅ FIX: optional call (non rompe TS)
            try {
              clearFn?.();

              try {
                window.localStorage.removeItem("tf_cart_v1");
                window.localStorage.removeItem("tf_cart");
                window.localStorage.removeItem("cart");
              } catch {
                // ignore
              }

              try {
                window.sessionStorage.setItem(key, "1");
              } catch {
                // ignore
              }
            } catch {
              // non bloccare
            }

            setStatus("paid");
            return;
          }

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
          : status === "no_clear"
          ? "CartProvider non espone clear/clearCart/reset"
          : status === "missing"
          ? "sessionId mancante"
          : "errore confirm"}
      </div>
    </div>
  );
}
