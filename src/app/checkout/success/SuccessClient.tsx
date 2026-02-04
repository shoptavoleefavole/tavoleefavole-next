"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";

type ConfirmState = "checking" | "paid" | "not_paid" | "error";

export default function SuccessClient() {
  const sp = useSearchParams();
  const sessionId = sp.get("session_id");

  const { clear } = useCart();

  const [state, setState] = useState<ConfirmState>("checking");
  const [msg, setMsg] = useState("Sto verificando il pagamento...");

  // evita doppie chiamate in dev (React Strict Mode)
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (!sessionId) {
      setState("error");
      setMsg("Manca session_id nella URL. Non posso verificare il pagamento, quindi non svuoto il carrello.");
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/checkout/confirm?session_id=${encodeURIComponent(sessionId)}`, {
          method: "GET",
          cache: "no-store",
        });

        const json = await res.json().catch(() => null);

        // ✅ Qui consideriamo “pagato” solo quando il backend lo conferma davvero
        const paid =
          res.ok &&
          (json?.ok === true ||
            json?.paid === true ||
            json?.status === "paid" ||
            json?.payment_status === "paid");

        if (paid) {
          clear(); // ✅ svuota e rimuove tf_cart_v2
          setState("paid");
          setMsg("Pagamento confermato ✅ Il carrello è stato svuotato.");
          return;
        }

        // se backend risponde ma non è paid, NON svuotiamo
        setState("not_paid");
        setMsg(
          json?.error
            ? `Pagamento non confermato: ${json.error} (carrello NON svuotato)`
            : "Pagamento non confermato dal server (carrello NON svuotato)."
        );
      } catch (e: any) {
        setState("error");
        setMsg("Errore durante la verifica. Carrello NON svuotato.");
      }
    })();
  }, [sessionId, clear]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-extrabold">Pagamento completato</h1>

      {sessionId ? <p className="mt-2 text-sm text-text/70">Session: {sessionId}</p> : null}

      <div
        className={[
          "mt-4 rounded-2xl border px-5 py-4 text-sm font-semibold",
          state === "paid"
            ? "border-green-200 bg-green-50 text-green-700"
            : state === "checking"
            ? "border-border bg-surface text-text/80"
            : "border-yellow-200 bg-yellow-50 text-yellow-800",
        ].join(" ")}
      >
        {msg}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background px-5 text-sm font-extrabold"
        >
          Torna alla Home
        </Link>

        <Link
          href="/account/ordini"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-contrast"
        >
          I miei ordini
        </Link>

        <Link
          href="/carrello"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background px-5 text-sm font-extrabold"
        >
          Vai al carrello
        </Link>
      </div>
    </main>
  );
}
