"use client";

// src/app/checkout/success/successclient.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearCartOnPaid } from "./ClearCartOnPaid";
import { useCart } from "@/components/cart/CartProvider";

type VerifyResponse = {
  ok: boolean;
  paid?: boolean;
  updated?: boolean;
  orderRef?: string | null;
  orderId?: number | null;
  message?: string;
  error?: string;
  details?: any;

  // opzionali (se li aggiungi lato API, non rompe)
  payment_status?: string;
  status?: string;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isPaid(data: VerifyResponse | null) {
  if (!data) return false;
  return data.paid === true || data.payment_status === "paid" || data.status === "complete";
}

export default function SuccessClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { clear } = useCart();

  const sid = useMemo(() => String(sessionId || "").trim(), [sessionId]);

  const [status, setStatus] = useState<"checking" | "paid" | "timeout" | "error">("checking");
  const [info, setInfo] = useState<VerifyResponse | null>(null);

  // anti doppio start (StrictMode)
  const startedRef = useRef(false);

  useEffect(() => {
    if (!sid) {
      setStatus("error");
      setInfo({ ok: false, error: "Missing session_id" });
      return;
    }

    // se già confermato una volta in questa sessione browser → mostra subito paid
    const confirmedKey = `checkout_paid_once:${sid}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(confirmedKey) === "1") {
      setStatus("paid");
      return;
    }

    if (startedRef.current) return;
    startedRef.current = true;

    let alive = true;

    (async () => {
      const start = Date.now();
      const maxMs = 22_000;

      let last: VerifyResponse | null = null;

      while (Date.now() - start < maxMs) {
        try {
          const res = await fetch(`/api/checkout/verify?session_id=${encodeURIComponent(sid)}`, {
            cache: "no-store",
          });

          // se API momentaneamente instabile → ritenta
          if (!res.ok) {
            last = {
              ok: false,
              error: `HTTP ${res.status}`,
              details: await res.text().catch(() => null),
            };
            if (!alive) return;
            await sleep(1100);
            continue;
          }

          const data = (await res.json().catch(() => null)) as VerifyResponse | null;

          if (!alive) return;

          if (!data) {
            last = { ok: false, error: "Empty JSON response" };
            await sleep(1100);
            continue;
          }

          setInfo(data);
          last = data;

          if (data.ok && isPaid(data)) {
            setStatus("paid");

            try {
              sessionStorage.setItem(confirmedKey, "1");
            } catch {}

            // ✅ svuota carrello UNA VOLTA sola e senza reload
            clearCartOnPaid({ sessionId: sid, clearProvider: clear });

            return;
          }

          // non pagato ancora: ritenta
          await sleep(1100);
        } catch (e: any) {
          last = { ok: false, error: "Network error", details: String(e?.message ?? e) };
          if (!alive) return;
          await sleep(1100);
        }
      }

      if (!alive) return;

      setInfo((prev) => prev ?? last);
      setStatus("timeout");
    })();

    return () => {
      alive = false;
    };
  }, [sid, clear]);

  // ===== UI =====

  const orderRef = info?.orderRef ?? null;
  const orderId = typeof info?.orderId === "number" ? info?.orderId : null;

  return (
    <main className="relative overflow-hidden">
      {/* sfondo decorativo */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-40 left-10 h-[420px] w-[420px] rounded-full bg-pink-400/20 blur-3xl" />
        <div className="absolute right-10 top-24 h-[360px] w-[360px] rounded-full bg-indigo-400/15 blur-3xl" />
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-3xl border border-border bg-background/80 p-6 shadow-sm backdrop-blur md:p-8">
          <div className="flex items-start gap-4">
            <div className="mt-1 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-green-500/10">
              <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M6.5 10.2l2.1 2.2 5-5.6"
                  stroke="currentColor"
                  className="text-green-600"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="flex-1">
              <h1 className="text-2xl font-extrabold md:text-3xl">Grazie per il tuo ordine!</h1>
              <p className="mt-2 text-sm text-text/70 md:text-base">
                {status === "checking" && "Stiamo verificando il pagamento in modo sicuro…"}
                {status === "paid" &&
                  "Pagamento confermato ✅ Abbiamo ricevuto il tuo ordine e lo stiamo preparando."}
                {status === "timeout" &&
                  "Stiamo ancora aspettando la conferma automatica. Se hai pagato, torna tra qualche secondo e ricarica la pagina."}
                {status === "error" && "C’è stato un problema nel controllo del pagamento."}
              </p>
            </div>
          </div>

          {/* box info ordine */}
          <div className="mt-6 grid gap-3 rounded-2xl border border-border bg-surface/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-extrabold">Dettagli ordine</div>
              <span
                className={[
                  "rounded-full border px-3 py-1 text-xs font-semibold",
                  status === "paid"
                    ? "border-green-200 text-green-700"
                    : status === "error"
                      ? "border-red-200 text-red-600"
                      : "border-border text-text/70",
                ].join(" ")}
              >
                {status === "paid" ? "PAGATO" : status === "error" ? "ERRORE" : "IN VERIFICA"}
              </span>
            </div>

            <div className="grid gap-2 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-text/70">Riferimento ordine</span>
                <span className="font-semibold">{orderRef ?? "—"}</span>
              </div>

              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-text/70">ID ordine</span>
                <span className="font-semibold">{orderId ?? "—"}</span>
              </div>

              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-text/70">Sessione Stripe</span>
                <span className="font-mono text-xs text-text/70 break-all">{sid || "—"}</span>
              </div>
            </div>
          </div>

          {/* messaggio “wow” */}
          {status === "paid" ? (
            <div className="mt-6 rounded-2xl border border-border bg-background p-4">
              <div className="text-sm font-extrabold">Cosa succede adesso?</div>
              <ul className="mt-3 grid gap-2 text-sm text-text/70">
                <li className="flex gap-2">
                  <span className="mt-0.5">•</span>
                  <span>
                    Prepariamo il pacco con cura (imballo protetto per prodotti da pasticceria).
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5">•</span>
                  <span>
                    Se hai bisogno di modifiche o assistenza, scrivici: rispondiamo velocemente.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5">•</span>
                  <span>
                    Vuoi continuare a fare scorta? Dai un’occhiata alle categorie più amate.
                  </span>
                </li>
              </ul>
            </div>
          ) : null}

          {/* CTA */}
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => router.push("/catalogo")}
              className="rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover"
            >
              Continua lo shopping
            </button>

            <Link
              href="/"
              className="rounded-xl border border-border px-5 py-3 text-sm font-extrabold hover:bg-surface-2"
            >
              Torna alla home
            </Link>

            {status !== "paid" ? (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-xl border border-border px-5 py-3 text-sm font-extrabold hover:bg-surface-2"
              >
                Ricarica
              </button>
            ) : null}
          </div>

          {/* debug solo in non-prod */}
          {process.env.NODE_ENV !== "production" && status !== "paid" && info ? (
            <pre className="mt-6 overflow-auto rounded-2xl bg-black/5 p-3 text-[11px]">
              {JSON.stringify(info, null, 2)}
            </pre>
          ) : null}

          <div className="mt-6 text-xs text-text/60">
            Hai bisogno di aiuto?{" "}
            <Link className="font-semibold text-link hover:text-link-hover" href="/supporto">
              Contatta l’assistenza
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}