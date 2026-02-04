"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
function safeNumber(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function safeString(v: unknown, fallback = "") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function TruckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M2.5 4.5h9v9h-9v-9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
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

function MetaBadges({ meta }: { meta?: Record<string, any> }) {
  if (!meta || typeof meta !== "object") return null;

  const shapeLabel = (() => {
    const shape = safeString(meta.shape);
    if (!shape) return "";
    if (shape === "tonda") return "Formato: Tonda";
    if (shape === "rettangolare") return "Formato: Rettangolare";
    if (shape === "personalizzato") return "Formato: Personalizzato";
    return `Formato: ${shape}`;
  })();

  const materialLabel = (() => {
    const material = safeString(meta.material);
    if (!material) return "";
    if (material === "ostia") return "Materiale: Ostia";
    if (material === "pasta_di_zucchero") return "Materiale: Pasta di zucchero";
    return `Materiale: ${material}`;
  })();

  const textLabel = (() => {
    const t = safeString(meta.text);
    if (!t) return "";
    return `Dedica: “${t}”`;
  })();

  const noteLabel = (() => {
    const n = safeString(meta.notes);
    if (!n) return "";
    return `Note: ${n}`;
  })();

  const badges = [materialLabel, shapeLabel, textLabel].filter(Boolean);

  return (
    <div className="mt-2">
      {badges.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {badges.map((b) => (
            <span
              key={b}
              className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-extrabold text-text/80"
            >
              {b}
            </span>
          ))}
        </div>
      ) : null}

      {noteLabel ? <div className="mt-2 text-xs text-muted-text">{noteLabel}</div> : null}
    </div>
  );
}

type Quote = {
  ok: boolean;
  auth?: { authenticated: boolean; isCompanyUser: boolean };
  pricedItems?: Array<{
    lineId: string | null;
    qty: number;
    unitPrice: number;
    baseUnitPrice: number;
    lineTotal: number;
    isOnSale: boolean;
    companyApplied: boolean;
  }>;
  totals?: {
    subtotal: number;
    discountTotal: number;
    shippingTotal: number;
    total: number;
    currency: string;
  };
  error?: string;
};

export default function CartView() {
  const { items, summary, removeItem, setQty, clear } = useCart();

  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const quoteAbortRef = useRef<AbortController | null>(null);

  // ---- QUOTE: calcola prezzi server-side (pubblico / azienda / cialde)
  useEffect(() => {
    quoteAbortRef.current?.abort();
    setCheckoutError(null);

    if (!items.length) {
      setQuote(null);
      return;
    }

    const controller = new AbortController();
    quoteAbortRef.current = controller;

    const run = async () => {
      try {
        setQuoteBusy(true);

        const payload = {
          currency: "EUR",
          shippingTotal: 0,
          items: items.map((it) => ({
            lineId: it.lineId,
            qty: clampQty(it.qty),
            // per prodotti Strapi
            id: Number.isFinite(Number(it.id)) ? Number(it.id) : undefined,
            productId: Number.isFinite(Number(it.id)) ? Number(it.id) : undefined,
            slug: it.slug,
            imageUrl: it.image,
            meta: it.meta ?? undefined,
          })),
        };

        const res = await fetch("/api/cart/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        const data = (await res.json().catch(() => null)) as Quote | null;

        if (!res.ok || !data?.ok) {
          setQuote({ ok: false, error: data?.error || `Quote fallita (HTTP ${res.status})` });
          return;
        }

        setQuote(data);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setQuote({ ok: false, error: e?.message ? String(e.message) : "Errore quote" });
      } finally {
        setQuoteBusy(false);
      }
    };

    run();

    return () => controller.abort();
  }, [items]);

  const quoteMap = useMemo(() => {
    const map = new Map<string, NonNullable<Quote["pricedItems"]>[number]>();
    for (const qi of quote?.pricedItems ?? []) {
      if (qi.lineId) map.set(qi.lineId, qi);
    }
    return map;
  }, [quote]);

  const subtotal =
    typeof quote?.totals?.subtotal === "number"
      ? quote!.totals!.subtotal
      : safeNumber(summary.total, 0);

  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const hasFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  const progress =
    FREE_SHIPPING_THRESHOLD > 0 ? Math.max(0, Math.min(1, subtotal / FREE_SHIPPING_THRESHOLD)) : 0;

  const canCheckout = items.length > 0 && !checkoutBusy;

  async function startCheckout() {
    if (checkoutBusy) return;
    setCheckoutError(null);

    if (!items.length) {
      setCheckoutError("Il carrello è vuoto.");
      return;
    }

    try {
      setCheckoutBusy(true);

      const payload = {
        items: items.map((it) => ({
          id: it.id,
          slug: it.slug,
          name: it.name,
          price: safeNumber(it.price, 0), // ignorato server-side
          qty: clampQty(it.qty),
          imageUrl: it.image,
          meta: it.meta ?? undefined,
          productId: Number.isFinite(Number(it.id)) ? Number(it.id) : undefined,
          lineId: it.lineId,
        })),
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
      const data = (() => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })();

      if (!res.ok) {
        const msg = data?.error || data?.message || `Checkout fallito (HTTP ${res.status})`;
        setCheckoutError(typeof msg === "string" ? msg : "Checkout fallito.");
        return;
      }

      const url = data?.url;
      if (!url || typeof url !== "string") {
        setCheckoutError("Checkout fallito: URL Stripe mancante.");
        return;
      }

      window.location.href = url;
    } catch (e: any) {
      setCheckoutError(e?.message ? String(e.message) : "Errore imprevisto durante il checkout.");
    } finally {
      setTimeout(() => setCheckoutBusy(false), 250);
    }
  }

  const header = useMemo(
    () => (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-text">Carrello</h1>
          <p className="mt-1 text-sm text-muted-text">Rivedi i prodotti e completa l’ordine in pochi passaggi.</p>
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
    ),
    [items.length, clear]
  );

  const auth = quote?.auth;
  const showAuthHint = items.length > 0;

  return (
    <Container>
      <div className="py-10">
        {header}

        {items.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-border bg-background p-8 text-center">
            <div className="text-base font-semibold text-text">Il carrello è vuoto</div>
            <p className="mt-1 text-sm text-muted-text">Aggiungi un prodotto dal catalogo per iniziare.</p>
            <div className="mt-6">
              <ButtonLink href="/catalogo">Vai al catalogo</ButtonLink>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
            <section aria-label="Articoli" className="space-y-4">
              {/* Hint login / azienda */}
              {showAuthHint ? (
                <div className="rounded-2xl border border-border bg-surface p-4">
                  <div className="text-sm font-extrabold text-text">
                    {auth?.authenticated
                      ? auth?.isCompanyUser
                        ? "Sei loggato come AZIENDA: prezzi riservati applicati ✅"
                        : "Sei loggato ✅"
                      : "Hai un account? Accedi per velocizzare l’acquisto (e prezzi aziende se disponibili)."}
                  </div>
                  {!auth?.authenticated ? (
                    <div className="mt-3">
                      <ButtonLink href="/account?next=/carrello">Accedi / Registrati</ButtonLink>
                    </div>
                  ) : null}
                  {quoteBusy ? <div className="mt-2 text-xs text-muted-text">Aggiorno i prezzi…</div> : null}
                  {quote?.ok === false && quote?.error ? (
                    <div className="mt-2 text-xs font-semibold text-red-600">{quote.error}</div>
                  ) : null}
                </div>
              ) : null}

              {/* Banner spedizione gratuita */}
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background">
                    <TruckIcon />
                  </span>

                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-text">
                      {hasFreeShipping ? "Spedizione gratuita attiva ✅" : "Spedizione gratuita sopra 79€"}
                    </div>

                    <div className="mt-1 text-sm text-text/70">
                      {hasFreeShipping ? (
                        "Hai raggiunto la soglia: la spedizione è gratuita."
                      ) : (
                        <>
                          Ti mancano <b className="text-text">{formatEUR(remaining)}</b> per ottenere la spedizione gratuita.
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
                        {formatEUR(Math.min(subtotal, FREE_SHIPPING_THRESHOLD))} / {formatEUR(FREE_SHIPPING_THRESHOLD)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {items.map((it) => {
                const img = it.image ?? "/placeholder.jpg";
                const slug = safeString(it.slug);
                const isLinkable = !!slug;

                const qi = quoteMap.get(it.lineId);
                const unit = typeof qi?.unitPrice === "number" ? qi.unitPrice : it.price;
                const base = typeof qi?.baseUnitPrice === "number" ? qi.baseUnitPrice : null;
                const hasStrike = typeof base === "number" && base > unit;

                return (
                  <div
                    key={it.lineId}
                    className="grid gap-4 rounded-2xl border border-border bg-background p-4 shadow-sm sm:grid-cols-[120px_1fr]"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-surface">
                      <Image src={img} alt={it.name} fill className="object-cover" sizes="120px" />
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          {isLinkable ? (
                            <Link
                              href={`/prodotto/${slug}`}
                              className="text-sm font-semibold text-text hover:text-link-hover line-clamp-2"
                            >
                              {it.name}
                            </Link>
                          ) : (
                            <div className="text-sm font-semibold text-text line-clamp-2">{it.name}</div>
                          )}

                          <div className="mt-1 flex items-baseline gap-2">
                            <div className="text-sm font-extrabold text-text">{formatEUR(unit)}</div>
                            {hasStrike ? (
                              <div className="text-xs line-through text-text/50">{formatEUR(base!)}</div>
                            ) : null}
                          </div>

                          <MetaBadges meta={it.meta as any} />
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(it.lineId)}
                          className="shrink-0 rounded-xl px-3 py-2 text-sm font-semibold text-text hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          aria-label="Rimuovi articolo"
                        >
                          Rimuovi
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        {/* Quantità */}
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-muted-text">Quantità</div>

                          <div className="inline-flex items-center overflow-hidden rounded-xl border border-border bg-background">
                            <button
                              type="button"
                              onClick={() => setQty(it.lineId, Math.max(1, clampQty(it.qty) - 1))}
                              className="h-10 w-10 grid place-items-center hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                              aria-label="Diminuisci quantità"
                            >
                              <span className="text-lg leading-none">−</span>
                            </button>

                            <input
                              type="number"
                              min={1}
                              value={clampQty(it.qty)}
                              onChange={(e) => setQty(it.lineId, clampQty(e.target.value))}
                              className="h-10 w-16 border-x border-border bg-background px-2 text-center text-sm text-text outline-none focus:ring-2 focus:ring-primary"
                              aria-label="Quantità"
                              inputMode="numeric"
                            />

                            <button
                              type="button"
                              onClick={() => setQty(it.lineId, clampQty(it.qty) + 1)}
                              className="h-10 w-10 grid place-items-center hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                              aria-label="Aumenta quantità"
                            >
                              <span className="text-lg leading-none">+</span>
                            </button>
                          </div>
                        </div>

                        <div className="text-sm font-extrabold text-text">{formatEUR(clampQty(it.qty) * unit)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
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
                  <span className="text-text">
                    {formatEUR(typeof quote?.totals?.subtotal === "number" ? quote.totals.subtotal : subtotal)}
                  </span>
                </div>

                {typeof quote?.totals?.discountTotal === "number" && quote.totals.discountTotal > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-text">Risparmio</span>
                    <span className="text-text">- {formatEUR(quote.totals.discountTotal)}</span>
                  </div>
                ) : null}

                <div className="flex items-center justify-between">
                  <span className="text-muted-text">Spedizione</span>
                  <span className="text-text">{formatEUR(0)}</span>
                </div>

                <div className="mt-4 border-t border-border pt-4 flex items-center justify-between">
                  <span className="text-sm font-extrabold text-text">Totale</span>
                  <span className="text-base font-extrabold text-text">
                    {formatEUR(typeof quote?.totals?.total === "number" ? quote.totals.total : subtotal)}
                  </span>
                </div>
              </div>

              <div className="mt-4">
                <Button className="w-full" onClick={startCheckout} disabled={!canCheckout}>
                  {checkoutBusy ? "Reindirizzo a Stripe..." : "Vai al checkout"}
                </Button>
              </div>

              {checkoutError ? (
                <p className="mt-3 text-xs font-semibold text-red-600">{checkoutError}</p>
              ) : (
                <p className="mt-3 text-xs text-muted-text">Verrai reindirizzato al checkout sicuro Stripe.</p>
              )}
            </aside>
          </div>
        )}
      </div>
    </Container>
  );
}
