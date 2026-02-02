"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import Container from "@/components/Container";
import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import { useCart } from "@/components/cart/CartProvider";
import { formatEUR } from "@/lib/format";

const FREE_SHIPPING_THRESHOLD = 79;

function clampQty(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

function TruckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M2.5 4.5h9v9h-9v-9z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 7.5h3.2l2 2.3v3.7h-5.2V7.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M6.2 15.8a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM14.3 15.8a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function CartView() {
  const { items, summary, removeItem, setQty, clear } = useCart();

  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const subtotal = Number(summary.total ?? 0);
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const hasFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  const progress =
    FREE_SHIPPING_THRESHOLD > 0
      ? Math.max(0, Math.min(1, subtotal / FREE_SHIPPING_THRESHOLD))
      : 0;

  async function startCheckout() {
    if (checkoutBusy) return; // anti doppio click
    setCheckoutError(null);

    if (items.length === 0) {
      setCheckoutError("Il carrello è vuoto.");
      return;
    }

    try {
      setCheckoutBusy(true);

      // 🔁 payload minimale: items (l'API legge anche user via cookie tf_token)
      const payload = {
        items: items.map((it) => ({
          // Manteniamo entrambi i campi per compatibilità (l'API normalizza)
          name: it.name,
          price: Number(it.price),
          qty: Number(it.qty),
          imageUrl: it.image,
          productId: typeof it.id === "number" ? it.id : undefined,
        })),

        // Defaults “safe”: lato API gestisce currency, totals ecc.
        billingType: "PRIVATE",
        billingSnapshot: {},
        currency: "EUR",
        shippingTotal: 0,
        discountTotal: 0,
      };

      const res = await fetch("/api/checkout/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const text = await res.text().catch(() => "");
      const json = (() => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })();

      if (!res.ok) {
        // 401: non loggato (coerente con API)
        if (res.status === 401) {
          setCheckoutError("Devi accedere per completare l’ordine.");
          return;
        }

        const msg =
          (json as any)?.error ||
          (json as any)?.message ||
          `Checkout fallito (HTTP ${res.status})`;
        setCheckoutError(typeof msg === "string" ? msg : "Checkout fallito.");
        return;
      }

      const url = (json as any)?.url;
      if (!url || typeof url !== "string") {
        setCheckoutError("Checkout fallito: URL Stripe mancante.");
        return;
      }

      // ✅ redirect su Stripe
      window.location.href = url;
    } catch (e: any) {
      setCheckoutError(e?.message ? String(e.message) : "Errore imprevisto durante il checkout.");
    } finally {
      // non “sblocchiamo” subito se stiamo redirigendo, ma in caso di errore sì
      setTimeout(() => setCheckoutBusy(false), 250);
    }
  }

  return (
    <Container>
      <div className="py-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-text">Carrello</h1>
            <p className="mt-1 text-sm text-muted-text">
              Rivedi i prodotti e completa l’ordine in pochi passaggi.
            </p>
          </div>

          {items.length > 0 ? (
            <button
              type="button"
              onClick={clear}
              className="text-sm font-semibold text-link hover:text-link-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Svuota carrello
            </button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-border bg-background p-8 text-center">
            <div className="text-base font-semibold text-text">Il carrello è vuoto</div>
            <p className="mt-1 text-sm text-muted-text">
              Aggiungi un prodotto dal catalogo per iniziare.
            </p>
            <div className="mt-6">
              <ButtonLink href="/catalogo">Vai al catalogo</ButtonLink>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
            <section aria-label="Articoli" className="space-y-4">
              {/* ✅ Banner spedizione gratuita SOLO nel carrello */}
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background">
                    <TruckIcon />
                  </span>

                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-text">
                      {hasFreeShipping
                        ? "Spedizione gratuita attiva ✅"
                        : "Spedizione gratuita sopra 79€"}
                    </div>

                    <div className="mt-1 text-sm text-text/70">
                      {hasFreeShipping ? (
                        "Hai raggiunto la soglia: la spedizione è gratuita."
                      ) : (
                        <>
                          Ti mancano{" "}
                          <b className="text-text">{formatEUR(remaining)}</b> per ottenere la
                          spedizione gratuita.
                        </>
                      )}
                    </div>

                    <div className="mt-3">
                      <div className="h-2 w-full overflow-hidden rounded-full border border-border bg-background">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${Math.round(progress * 100)}%` }}
                          aria-hidden="true"
                        />
                      </div>
                      <div className="mt-1 text-xs text-muted-text">
                        {formatEUR(Math.min(subtotal, FREE_SHIPPING_THRESHOLD))} /{" "}
                        {formatEUR(FREE_SHIPPING_THRESHOLD)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {items.map((it) => (
                <div
                  key={it.id}
                  className="grid gap-4 rounded-2xl border border-border bg-background p-4 shadow-sm sm:grid-cols-[120px_1fr]"
                >
                  <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-surface">
                    <Image 
                      src={it.image ?? "/placeholder.jpg"} 
                      alt={it.name} 
                      fill 
                      className="object-cover" 
                      sizes="120px" 
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Link
                          href={`/prodotto/${it.slug}`}
                          className="text-sm font-semibold text-text hover:text-link-hover line-clamp-2"
                        >
                          {it.name}
                        </Link>
                        <div className="mt-1 text-sm text-muted-text">{formatEUR(it.price)}</div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(it.id)}
                        className="shrink-0 rounded-xl px-3 py-2 text-sm font-semibold text-text hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        aria-label="Rimuovi articolo"
                      >
                        Rimuovi
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {/* ✅ Quantità: - / input / + con clamp */}
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-muted-text">Quantità</div>

                        <div className="inline-flex items-center overflow-hidden rounded-xl border border-border bg-background">
                          <button
                            type="button"
                            onClick={() => setQty(it.id, clampQty(it.qty) - 1)}
                            className="h-10 w-10 grid place-items-center hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            aria-label="Diminuisci quantità"
                          >
                            <span className="text-lg leading-none">−</span>
                          </button>

                          <input
                            type="number"
                            min={1}
                            value={it.qty}
                            onChange={(e) => setQty(it.id, clampQty(e.target.value))}
                            onBlur={() => setQty(it.id, clampQty(it.qty))}
                            className="h-10 w-16 border-x border-border bg-background px-2 text-center text-sm text-text outline-none focus:ring-2 focus:ring-primary"
                            aria-label="Quantità"
                            inputMode="numeric"
                          />

                          <button
                            type="button"
                            onClick={() => setQty(it.id, clampQty(it.qty) + 1)}
                            className="h-10 w-10 grid place-items-center hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            aria-label="Aumenta quantità"
                          >
                            <span className="text-lg leading-none">+</span>
                          </button>
                        </div>
                      </div>

                      <div className="text-sm font-extrabold text-text">
                        {formatEUR(it.qty * it.price)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </section>

            <aside className="h-fit rounded-2xl border border-border bg-surface p-5">
              <div className="text-sm font-extrabold text-text">Riepilogo</div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-text">Articoli</span>
                  <span className="text-text">{summary.count}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-text">Subtotale</span>
                  <span className="text-text">{formatEUR(subtotal)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-text">Spedizione</span>
                  <span className="text-text">{formatEUR(0)}</span>
                </div>

                <div className="mt-4 border-t border-border pt-4 flex items-center justify-between">
                  <span className="text-sm font-extrabold text-text">Totale</span>
                  <span className="text-base font-extrabold text-text">{formatEUR(subtotal)}</span>
                </div>
              </div>

              <div className="mt-4">
                <Button className="w-full" onClick={startCheckout} disabled={checkoutBusy}>
                  {checkoutBusy ? "Reindirizzo a Stripe..." : "Vai al checkout"}
                </Button>
              </div>

              {checkoutError ? (
                <p className="mt-3 text-xs font-semibold text-red-600">{checkoutError}</p>
              ) : (
                <p className="mt-3 text-xs text-muted-text">
                  Verrai reindirizzato al checkout sicuro Stripe.
                </p>
              )}
            </aside>
          </div>
        )}
      </div>
    </Container>
  );
}
