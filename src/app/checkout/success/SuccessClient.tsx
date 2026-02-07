"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";

type ConfirmResp = {
  ok?: boolean;
  paid?: boolean;
  updated?: boolean;
  orderRef?: string;
  orderId?: string | number;
  payment_status?: string; // es: "paid"
  status?: string; // es: "complete"
  error?: string;
};

function isPaidResponse(data: ConfirmResp) {
  return (
    data?.paid === true ||
    data?.payment_status === "paid" ||
    data?.status === "complete"
  );
}

// fetch con timeout (così non resta appeso)
async function fetchJsonWithTimeout(url: string, ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);

  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { "x-checkout-confirm": "1" },
      signal: ctrl.signal,
    });

    const data = (await res.json().catch(() => ({}))) as ConfirmResp;
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(t);
  }
}

export default function SuccessClient() {
  const router = useRouter();
  const sp = useSearchParams();

  // string | null -> string (safe)
  const sid = sp.get("session_id") ?? "";

  const { clear } = useCart();

  const [ui, setUi] = useState<"checking" | "paid" | "failed">("checking");
  const [message, setMessage] = useState("Checkout: verifico il pagamento…");
  const [orderInfo, setOrderInfo] = useState<{
    orderRef?: string;
    orderId?: string | number;
  }>({});

  // evita doppi loop (StrictMode) + evita polling multipli
  const startedRef = useRef(false);

  // per pulire timer su unmount
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    // guard definitivo: senza session_id non ha senso continuare
    if (!sid) {
      setUi("failed");
      setMessage("Sessione di pagamento mancante.");
      return;
    }

    const key = `checkout_confirmed_${sid}`;

    // anti-refresh: se già confermato una volta, non ripollare
    if (typeof window !== "undefined" && window.sessionStorage.getItem(key) === "1") {
      setUi("paid");
      setMessage("Pagamento confermato ✅");
      return;
    }

    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    let attempts = 0;

    const MAX_ATTEMPTS = 18;       // numero tentativi
    const BASE_DELAY_MS = 650;     // base backoff
    const FETCH_TIMEOUT_MS = 6000; // timeout fetch singola chiamata

    async function poll() {
      if (cancelled) return;
      attempts += 1;

      try {
        const url = `/api/checkout/confirm?session_id=${encodeURIComponent(sid)}`;
        const { ok, data } = await fetchJsonWithTimeout(url, FETCH_TIMEOUT_MS);

        // salva info ordine se presenti (utile per UI)
        if (data?.orderRef || data?.orderId) {
          setOrderInfo({ orderRef: data.orderRef, orderId: data.orderId });
        }

        // se API dice pagato → stop definitivo
        if (ok && isPaidResponse(data)) {
          if (cancelled) return;

          setUi("paid");
          setMessage("Pagamento confermato ✅");

          // anti refresh
          window.sessionStorage.setItem(key, "1");

          // clear carrello 1 volta sola (in try/catch per sicurezza)
          try {
            clear();
          } catch {}

          clearTimer();
          return;
        }

        // se API risponde ma non è pagato ancora → riprova fino a MAX_ATTEMPTS
        if (attempts >= MAX_ATTEMPTS) {
          setUi("failed");
          setMessage(
            data?.error ||
              "Non riesco a confermare il pagamento. Se hai pagato, attendi 1 minuto e riprova."
          );
          clearTimer();
          return;
        }

        // backoff leggero
        const delay = BASE_DELAY_MS + attempts * 250;
        clearTimer();
        timeoutRef.current = window.setTimeout(poll, delay);
      } catch {
        // abort/errore rete
        if (attempts >= MAX_ATTEMPTS) {
          setUi("failed");
          setMessage("Errore di rete nel controllo pagamento. Riprova tra poco.");
          clearTimer();
          return;
        }

        const delay = BASE_DELAY_MS + attempts * 300;
        clearTimer();
        timeoutRef.current = window.setTimeout(poll, delay);
      }
    }

    poll();

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [sid, clear]);

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      {ui === "checking" && (
        <>
          <h1 className="text-2xl font-semibold">Grazie!</h1>
          <p className="mt-3">{message}</p>
          {(orderInfo.orderRef || orderInfo.orderId) && (
            <p className="mt-2 text-sm opacity-70">
              {orderInfo.orderRef ? `Rif. ordine: ${orderInfo.orderRef}` : null}
              {orderInfo.orderId ? ` (ID: ${orderInfo.orderId})` : null}
            </p>
          )}
        </>
      )}

      {ui === "paid" && (
        <>
          <h1 className="text-2xl font-semibold">Ordine confermato 🎉</h1>
          <p className="mt-3">{message}</p>
          {(orderInfo.orderRef || orderInfo.orderId) && (
            <p className="mt-2 text-sm opacity-70">
              {orderInfo.orderRef ? `Rif. ordine: ${orderInfo.orderRef}` : null}
              {orderInfo.orderId ? ` (ID: ${orderInfo.orderId})` : null}
            </p>
          )}

          <button
            className="mt-6 rounded-md bg-black px-4 py-2 text-white"
            onClick={() => router.push("/")}
          >
            Torna alla home
          </button>
        </>
      )}

      {ui === "failed" && (
        <>
          <h1 className="text-2xl font-semibold">Controllo pagamento</h1>
          <p className="mt-3">{message}</p>

          <div className="mt-6 flex gap-3">
            <button
              className="rounded-md border px-4 py-2"
              onClick={() => window.location.reload()}
            >
              Riprova
            </button>
            <button
              className="rounded-md bg-black px-4 py-2 text-white"
              onClick={() => router.push("/")}
            >
              Torna alla home
            </button>
          </div>
        </>
      )}
    </div>
  );
}
