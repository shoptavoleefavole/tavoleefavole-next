"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function clearCartRobust(sessionId: string) {
  // Niente reload automatico (più elegante). Pulizia + eventi per far aggiornare i badge.
  const keysToClear = [STORAGE_KEY, "cart", "tavoleefavole_cart"];

  try {
    for (const k of keysToClear) {
      try {
        localStorage.removeItem(k);
      } catch {}
    }

    // evento custom (se CartProvider lo ascolta)
    try {
      window.dispatchEvent(new CustomEvent("tf_cart:clear", { detail: { keys: keysToClear, sessionId } }));
    } catch {}

    // storage event (fallback)
    try {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: null, oldValue: null }));
    } catch {
      try {
        window.dispatchEvent(new Event("storage"));
      } catch {}
    }
  } catch {}
}

function CheckIllustration() {
  return (
    <svg viewBox="0 0 240 180" className="h-40 w-full" aria-hidden="true">
      <defs>
        <linearGradient id="g1" x1="0" x2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.06" />
        </linearGradient>
      </defs>

      {/* confetti */}
      <circle cx="30" cy="30" r="4" fill="currentColor" opacity="0.25" />
      <circle cx="210" cy="26" r="5" fill="currentColor" opacity="0.18" />
      <circle cx="196" cy="58" r="3" fill="currentColor" opacity="0.25" />
      <circle cx="44" cy="68" r="3" fill="currentColor" opacity="0.18" />
      <path d="M22 52l10-6 4 8-10 6z" fill="currentColor" opacity="0.14" />
      <path d="M204 76l12 4-4 12-12-4z" fill="currentColor" opacity="0.12" />

      {/* card */}
      <rect x="28" y="44" width="184" height="112" rx="20" fill="url(#g1)" />
      <rect x="40" y="58" width="160" height="86" rx="16" fill="white" opacity="0.9" />

      {/* check circle */}
      <circle cx="120" cy="92" r="26" fill="currentColor" opacity="0.14" />
      <circle cx="120" cy="92" r="20" fill="white" />
      <path
        d="M112 92l5.5 6.2L130 84.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* lines */}
      <rect x="78" y="122" width="84" height="8" rx="4" fill="currentColor" opacity="0.12" />
      <rect x="64" y="136" width="112" height="6" rx="3" fill="currentColor" opacity="0.08" />
    </svg>
  );
}

function pill(text: string) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-white/70 px-3 py-1 text-xs font-semibold">
      {text}
    </span>
  );
}

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const params = useSearchParams();

  const sessionId = useMemo(() => String(params.get("session_id") || "").trim(), [params]);

  const [status, setStatus] = useState<"checking" | "paid" | "timeout" | "error">("checking");
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
      const maxMs = 25_000;

      let lastInfo: VerifyResponse | null = null;

      while (Date.now() - start < maxMs) {
        try {
          const res = await fetch(`/api/checkout/verify?session_id=${encodeURIComponent(sessionId)}`, {
            cache: "no-store",
          });

          if (!res.ok) {
            lastInfo = { ok: false, error: `HTTP ${res.status}`, details: await res.text().catch(() => null) };
            if (!alive) return;
            await sleep(1200);
            continue;
          }

          const data = (await res.json().catch(() => null)) as VerifyResponse | null;
          if (!alive) return;

          if (!data) {
            lastInfo = { ok: false, error: "Bad/empty JSON response" };
            await sleep(1200);
            continue;
          }

          if (data.ok === false) {
            lastInfo = data;
            await sleep(1200);
            continue;
          }

          setInfo(data);
          lastInfo = data;

          if (data.paid) {
            setStatus("paid");
            clearCartRobust(sessionId);
            return;
          }

          await sleep(1200);
        } catch (e: any) {
          lastInfo = { ok: false, error: "Network error", details: String(e?.message ?? e) };
          if (!alive) return;
          await sleep(1200);
        }
      }

      if (!alive) return;
      setInfo((prev) => prev ?? lastInfo);
      setStatus("timeout");
    }

    run();
    return () => {
      alive = false;
    };
  }, [sessionId]);

  const orderLabel = info?.orderRef || (typeof info?.orderId === "number" ? `#${info.orderId}` : null);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-white via-white to-surface-2 p-6 shadow-sm md:p-10">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-black/5 blur-3xl" />

        <div className="relative grid gap-10 md:grid-cols-12 md:items-center">
          <div className="md:col-span-6">
            <div className="flex flex-wrap gap-2">
              {pill("Pagamento sicuro")}
              {pill("Assistenza dedicata")}
              {pill("Spedizione rapida")}
            </div>

            <h1 className="mt-4 text-3xl font-extrabold leading-tight md:text-4xl">
              {status === "paid" ? "Ordine confermato 🎉" : "Stiamo confermando il pagamento…"}
            </h1>

            <p className="mt-3 text-sm text-text/70 md:text-base">
              {status === "paid"
                ? "Grazie per il tuo acquisto! Abbiamo ricevuto il pagamento e stiamo già preparando il tuo ordine."
                : "Ci siamo quasi: stiamo verificando l’esito del pagamento con Stripe e aggiornando l’ordine."}
            </p>

            {orderLabel ? (
              <div className="mt-4 rounded-2xl border border-border bg-white/70 px-4 py-3">
                <div className="text-xs font-semibold text-text/60">Riferimento ordine</div>
                <div className="mt-1 text-lg font-extrabold">{orderLabel}</div>
                <div className="mt-1 text-xs text-text/60">
                  Sessione: <span className="font-mono">{sessionId.slice(0, 16)}…</span>
                </div>
              </div>
            ) : null}

            {status === "paid" ? (
              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-border bg-white/70 p-4">
                  <div className="text-sm font-extrabold">Cosa succede adesso?</div>
                  <ul className="mt-2 space-y-2 text-sm text-text/70">
                    <li className="flex gap-2">
                      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-white">
                        ✓
                      </span>
                      <span>Riceverai una conferma via email (se l’hai inserita in checkout).</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-white">
                        ✓
                      </span>
                      <span>Prepariamo il pacco con imballo curato e spedizione veloce.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-white">
                        ✓
                      </span>
                      <span>Hai bisogno? Scrivici e ti aiutiamo subito.</span>
                    </li>
                  </ul>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    className="h-11 rounded-xl bg-black px-5 text-sm font-extrabold text-white"
                    onClick={() => router.push("/")}
                  >
                    Continua lo shopping
                  </button>

                  <button
                    className="h-11 rounded-xl border border-border bg-white px-5 text-sm font-extrabold hover:bg-surface-2"
                    onClick={() => window.location.reload()}
                  >
                    Se il carrello non è vuoto, aggiorna
                  </button>
                </div>
              </div>
            ) : status === "timeout" ? (
              <div className="mt-5 rounded-2xl border border-border bg-white/70 p-4">
                <div className="text-sm font-extrabold">Conferma in corso</div>
                <p className="mt-2 text-sm text-text/70">
                  Non ho ancora ricevuto la conferma automatica. Se hai pagato, spesso basta attendere qualche secondo e
                  ricaricare.
                </p>
                {info ? (
                  <pre className="mt-3 overflow-auto rounded-lg bg-surface p-3 text-xs">
                    {JSON.stringify(info, null, 2)}
                  </pre>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    className="h-11 rounded-xl bg-black px-5 text-sm font-extrabold text-white"
                    onClick={() => window.location.reload()}
                  >
                    Riprova
                  </button>
                  <button
                    className="h-11 rounded-xl border border-border bg-white px-5 text-sm font-extrabold hover:bg-surface-2"
                    onClick={() => router.push("/")}
                  >
                    Torna al negozio
                  </button>
                </div>
              </div>
            ) : status === "error" ? (
              <div className="mt-5 rounded-2xl border border-red-200 bg-white/70 p-4">
                <div className="text-sm font-extrabold text-red-600">Errore durante la verifica</div>
                <p className="mt-2 text-sm text-text/70">
                  Se hai completato il pagamento su Stripe, prova a ricaricare. In caso di dubbi contattaci.
                </p>
                <pre className="mt-3 overflow-auto rounded-lg bg-surface p-3 text-xs">
                  {JSON.stringify(info, null, 2)}
                </pre>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    className="h-11 rounded-xl bg-black px-5 text-sm font-extrabold text-white"
                    onClick={() => window.location.reload()}
                  >
                    Riprova
                  </button>
                  <button
                    className="h-11 rounded-xl border border-border bg-white px-5 text-sm font-extrabold hover:bg-surface-2"
                    onClick={() => router.push("/")}
                  >
                    Torna al negozio
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 text-sm text-text/70">Verifica in corso…</div>
            )}
          </div>

          <div className="md:col-span-6">
            <div className="rounded-3xl border border-border bg-white/70 p-6">
              <div className="text-sm font-extrabold">Grazie da Tavole e Favole</div>
              <p className="mt-2 text-sm text-text/70">
                Ogni ordine è preparato con cura, come in laboratorio: qualità, attenzione e un pizzico di dolcezza.
              </p>
              <div className="mt-4 text-primary">
                <CheckIllustration />
              </div>
              <div className="mt-4 grid gap-2 text-sm text-text/70">
                <div className="rounded-xl border border-border bg-white px-4 py-3">
                  <b>Consiglio:</b> se hai acquistato prodotti delicati, conservali al fresco e lontano da fonti di calore.
                </div>
                <div className="rounded-xl border border-border bg-white px-4 py-3">
                  <b>Assistenza:</b> siamo qui se ti serve una mano con l’ordine.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
