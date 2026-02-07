// src/app/checkout/success/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type VerifyResponse = {
  ok: boolean;
  paid?: boolean;
  updated?: boolean;
  orderRef?: string | null;
  orderId?: number | null;
  message?: string;
  error?: string;
  details?: any;
};

const STORAGE_KEY = "tf_cart_v2";

function clearCartRobust(sessionId: string) {
  // Evita loop di reload: facciamo la "pulizia + reload" una sola volta per session_id
  const reloadGuardKey = `tf_cart_cleared_once:${sessionId || "no_session"}`;

  try {
    // 1) Svuota TUTTE le chiavi note
    const keysToClear = [STORAGE_KEY, "cart", "tavoleefavole_cart"];
    for (const k of keysToClear) {
      try {
        localStorage.removeItem(k);
      } catch {}
    }

    // 2) Broadcast: se in futuro il CartProvider ascolta questo evento, si aggiorna anche senza reload
    try {
      window.dispatchEvent(new CustomEvent("tf_cart:clear", { detail: { keys: keysToClear } }));
    } catch {}

    // 3) Alcuni provider ascoltano "storage" (ma in same-tab non parte da solo): lo spariamo manualmente
    try {
      // StorageEvent può non essere costruibile in tutti i browser: per sicurezza è in try/catch
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: null, oldValue: null }));
    } catch {
      try {
        window.dispatchEvent(new Event("storage"));
      } catch {}
    }

    // 4) HARD RESET (garantito): reload UNA VOLTA
    // Se il CartProvider mantiene lo stato in memoria, il reload lo azzera sicuramente.
    if (!sessionStorage.getItem(reloadGuardKey)) {
      sessionStorage.setItem(reloadGuardKey, "1");
      setTimeout(() => {
        window.location.reload();
      }, 80);
    }
  } catch {
    // se localStorage è bloccato, almeno proviamo il reload
    try {
      if (!sessionStorage.getItem(reloadGuardKey)) {
        sessionStorage.setItem(reloadGuardKey, "1");
        setTimeout(() => window.location.reload(), 80);
      }
    } catch {}
  }
}

export default function CheckoutSuccessPage() {
  const params = useSearchParams();
  const router = useRouter();

  const sessionId = useMemo(() => String(params.get("session_id") || "").trim(), [params]);

  const [status, setStatus] = useState<"checking" | "paid" | "notpaid" | "error" | "timeout">("checking");
  const [info, setInfo] = useState<VerifyResponse | null>(null);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!sessionId) {
        if (!alive) return;
        setStatus("error");
        setInfo({ ok: false, error: "Missing session_id" });
        return;
      }

      const start = Date.now();
      const maxMs = 20_000;

      while (Date.now() - start < maxMs) {
        try {
          const res = await fetch(`/api/checkout/verify?session_id=${encodeURIComponent(sessionId)}`, {
            cache: "no-store",
          });

          const data = (await res.json().catch(() => null)) as VerifyResponse | null;

          if (!alive) return;

          if (!data || data.ok === false) {
            setStatus("error");
            setInfo(data ?? { ok: false, error: "Bad response" });
            return;
          }

          setInfo(data);

          if (data.paid) {
            setStatus("paid");

            // ✅ svuota SEMPRE il carrello dopo pagamento confermato (robusto)
            clearCartRobust(sessionId);

            return;
          }

          // non è paid: aspetta e riprova
          await new Promise((r) => setTimeout(r, 1200));
        } catch {
          // errore rete: ritenta
          await new Promise((r) => setTimeout(r, 1200));
        }
      }

      if (!alive) return;
      setStatus("timeout");
    }

    run();

    return () => {
      alive = false;
    };
  }, [sessionId]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Grazie!</h1>

      {status === "checking" && <p className="mt-3">Checkout: verifico il pagamento…</p>}

      {status === "paid" && (
        <>
          <p className="mt-3">Pagamento confermato ✅</p>
          <p className="mt-1 text-sm opacity-80">
            Ordine: {info?.orderRef ?? "-"} {typeof info?.orderId === "number" ? `(ID: ${info?.orderId})` : ""}
          </p>

          <button className="mt-6 rounded-lg bg-black px-4 py-2 text-white" onClick={() => router.push("/")}>
            Torna al negozio
          </button>
        </>
      )}

      {status === "timeout" && (
        <>
          <p className="mt-3">
            Sto ancora aspettando la conferma automatica. (In locale è normale se il webhook Stripe non è attivo)
          </p>
          <button className="mt-6 rounded-lg bg-black px-4 py-2 text-white" onClick={() => router.push("/")}>
            Torna al negozio
          </button>
        </>
      )}

      {status === "error" && (
        <>
          <p className="mt-3 text-red-600">Errore durante la verifica pagamento.</p>
          <pre className="mt-3 overflow-auto rounded bg-gray-100 p-3 text-xs">{JSON.stringify(info, null, 2)}</pre>
          <button className="mt-6 rounded-lg bg-black px-4 py-2 text-white" onClick={() => router.push("/")}>
            Torna al negozio
          </button>
        </>
      )}
    </main>
  );
}
