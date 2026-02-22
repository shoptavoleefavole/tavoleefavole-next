"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Container from "@/components/Container";
import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import { useCart } from "@/components/cart/CartProvider";
import { formatEUR } from "@/lib/format";

// Client-safe: Next inlines NEXT_PUBLIC_*
const STRAPI_PUBLIC_URL = (process.env.NEXT_PUBLIC_STRAPI_URL || "").replace(/\/+$/, "");

function clampQty(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(999, Math.floor(n)));
}

function safeNumber(v: unknown, fallback = 0) {
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : fallback;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeString(v: unknown, fallback = "") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function toIntOrNull(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.trim()) : Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i > 0 ? i : null;
}

function sanitizeSlug(v: unknown): string | null {
  const s = safeString(v, "");
  if (!s) return null;
  if (!/^[a-z0-9-]{2,120}$/i.test(s)) return null;
  return s;
}

// Se arriva "/uploads/..." dal carrello, rendila assoluta con STRAPI_PUBLIC_URL
function normalizeImageUrl(raw: unknown): string {
  const s = safeString(raw, "");
  if (!s) return "";

  if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("data:") || s.startsWith("blob:")) return s;
  if (s.startsWith("/brand/") || s.startsWith("/placeholder") || s.startsWith("/images/")) return s;
  if (s.startsWith("/uploads/") && STRAPI_PUBLIC_URL) return `${STRAPI_PUBLIC_URL}${s}`;
  return s;
}

function SafeImg({
  src,
  alt,
  className,
  fallbackSrc = "/brand/tavoleefavole-logo.svg",
  timeoutMs = 7000,
}: {
  src?: string;
  alt: string;
  className?: string;
  fallbackSrc?: string;
  timeoutMs?: number;
}) {
  const normalized = normalizeImageUrl(src);
  const [currentSrc, setCurrentSrc] = useState<string>(normalized || fallbackSrc);
  const loadedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    loadedRef.current = false;

    const next = normalizeImageUrl(src);
    setCurrentSrc(next || fallbackSrc);

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (!loadedRef.current) setCurrentSrc(fallbackSrc);
    }, timeoutMs);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [src, fallbackSrc, timeoutMs]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onLoad={() => {
        loadedRef.current = true;
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }}
      onError={() => {
        loadedRef.current = true;
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = null;
        if (currentSrc !== fallbackSrc) setCurrentSrc(fallbackSrc);
      }}
    />
  );
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

async function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const timeoutMs = init.timeoutMs ?? 12_000;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

type ShippingAddress = { country: string; postalCode: string; province: string };

function loadShippingAddress(): ShippingAddress | null {
  try {
    const raw = localStorage.getItem("tf_shipping_address_v1");
    if (!raw) return null;
    const j = JSON.parse(raw);
    const country = String(j?.country ?? "IT").trim();
    const postalCode = String(j?.postalCode ?? "").trim();
    const province = String(j?.province ?? "").trim();
    if (!postalCode && !province) return null;
    return { country, postalCode, province };
  } catch {
    return null;
  }
}

export default function CartView() {
  const router = useRouter();
  const { items, summary, removeItem, setQty, clear } = useCart();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const quoteAbortRef = useRef<AbortController | null>(null);

  // indirizzo salvato (per stima spedizione nel carrello)
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress | null>(null);

  // stima spedizione
  const [shippingQuoteBusy, setShippingQuoteBusy] = useState(false);
  const [shippingQuoteError, setShippingQuoteError] = useState<string | null>(null);
  const [shippingEur, setShippingEur] = useState<number | null>(null);

  // carica indirizzo da localStorage (se presente)
  useEffect(() => {
    setShippingAddress(loadShippingAddress());
  }, []);

  // ---- QUOTE: calcola prezzi server-side (pubblico / azienda / cialde)
  useEffect(() => {
    quoteAbortRef.current?.abort();

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
          items: items.map((it: any) => ({
            lineId: it.lineId,
            qty: clampQty(it.qty),
            id: toIntOrNull(it.id) ?? undefined,
            productId: toIntOrNull(it.productId) ?? toIntOrNull(it.id) ?? undefined,
            slug: it.slug,
            imageUrl: it.image,
            meta: it.meta ?? undefined,
          })),
        };

        const res = await fetchWithTimeout("/api/cart/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
          signal: controller.signal,
          timeoutMs: 12_000,
        });

        const data = (await res.json().catch(() => null)) as Quote | null;

        if (!res.ok || !data?.ok) {
          const msg = data?.error || `Quote fallita (HTTP ${res.status})`;
          setQuote({ ok: false, error: msg });
          return;
        }

        setQuote(data);
      } catch (e: any) {
        if (e?.name === "AbortError") {
          setQuote({ ok: false, error: "Timeout: aggiornamento prezzi troppo lento. Riprova tra poco." });
          return;
        }
        setQuote({ ok: false, error: e?.message ? String(e.message) : "Errore quote" });
      } finally {
        setQuoteBusy(false);
      }
    };

    run();

    return () => controller.abort();
  }, [items]);

  // ---- SHIPPING QUOTE: SOLO se ho indirizzo salvato
  useEffect(() => {
    let cancelled = false;

    if (!items.length) {
      setShippingQuoteBusy(false);
      setShippingQuoteError(null);
      setShippingEur(null);
      return;
    }

    // se non ho indirizzo, non calcolo
    if (!shippingAddress) {
      setShippingQuoteBusy(false);
      setShippingQuoteError(null);
      setShippingEur(null);
      return;
    }

    async function run() {
      setShippingQuoteError(null);
      setShippingEur(null);

      try {
        setShippingQuoteBusy(true);

        const payload = {
          shippingAddress,
          items: items.map((it: any) => ({
            productId: toIntOrNull(it?.productId) ?? toIntOrNull(it?.id) ?? undefined,
            id: toIntOrNull(it?.id) ?? undefined,
            slug: sanitizeSlug(it?.slug) ?? undefined,
            qty: clampQty(it?.qty),
          })),
        };

        const res = await fetchWithTimeout("/api/shipping/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
          timeoutMs: 12_000,
        });

        const data = await res.json().catch(() => null);
        if (cancelled) return;

        if (!res.ok || !data?.ok) {
          setShippingQuoteError("Spedizione non disponibile");
          return;
        }

        const eur = Number(data.shippingEur);
        if (!Number.isFinite(eur) || eur < 0) {
          setShippingQuoteError("Spedizione non disponibile");
          return;
        }

        setShippingEur(eur);
      } catch {
        if (!cancelled) setShippingQuoteError("Spedizione non disponibile");
      } finally {
        if (!cancelled) setShippingQuoteBusy(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [items, shippingAddress]);

  const quoteMap = useMemo(() => {
    const map = new Map<string, NonNullable<Quote["pricedItems"]>[number]>();
    for (const qi of quote?.pricedItems ?? []) {
      if (qi.lineId) map.set(qi.lineId, qi);
    }
    return map;
  }, [quote]);

  const subtotal = typeof quote?.totals?.subtotal === "number" ? quote!.totals!.subtotal : safeNumber(summary.total, 0);
  const baseTotal = typeof quote?.totals?.total === "number" ? quote!.totals!.total : subtotal;
  const estimatedTotal = typeof shippingEur === "number" ? baseTotal + shippingEur : baseTotal;

  const canGoCheckout = items.length > 0;

  return (
    <Container>
      <div className="py-10">
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
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background">
                    <TruckIcon />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-extrabold text-text">Consegna rapida 24/48h</div>
                    <div className="mt-1 text-sm text-text/70">
                      La spedizione viene calcolata <b>automaticamente</b> in base all’indirizzo (CAP/Provincia) al checkout.
                    </div>

                    <div className="mt-2 text-xs text-muted-text">
                      {shippingAddress ? (
                        shippingQuoteBusy ? (
                          "Calcolo spedizione in corso…"
                        ) : shippingQuoteError ? (
                          "Spedizione non disponibile (verifica indirizzo al checkout)."
                        ) : shippingEur != null ? (
                          `Spedizione stimata: ${formatEUR(shippingEur)}`
                        ) : (
                          "—"
                        )
                      ) : (
                        "Inserisci l’indirizzo al checkout per vedere il costo di spedizione."
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {items.map((it: any) => {
                const slug = safeString(it.slug);
                const isLinkable = !!slug;

                const qi = it.lineId ? quoteMap.get(it.lineId) : undefined;
                const unit = typeof qi?.unitPrice === "number" ? qi.unitPrice : safeNumber(it.price, 0);
                const base = typeof qi?.baseUnitPrice === "number" ? qi.baseUnitPrice : null;
                const hasStrike = typeof base === "number" && base > unit;

                const img = normalizeImageUrl(it.image) || "/brand/tavoleefavole-logo.svg";

                return (
                  <div
                    key={it.lineId}
                    className="grid gap-4 rounded-2xl border border-border bg-background p-4 shadow-sm sm:grid-cols-[120px_1fr]"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-surface">
                      <SafeImg src={img} alt={safeString(it.name, "Prodotto")} className="h-full w-full object-cover" />
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          {isLinkable ? (
                            <Link
                              href={`/prodotto/${encodeURIComponent(slug)}`}
                              className="text-sm font-semibold text-text hover:text-link-hover line-clamp-2"
                            >
                              {it.name}
                            </Link>
                          ) : (
                            <div className="text-sm font-semibold text-text line-clamp-2">{it.name}</div>
                          )}

                          <div className="mt-1 flex items-baseline gap-2">
                            <div className="text-sm font-extrabold text-text">{formatEUR(unit)}</div>
                            {hasStrike ? <div className="text-xs line-through text-text/50">{formatEUR(base!)}</div> : null}
                          </div>
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
                  <span className="text-text">{formatEUR(subtotal)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-text">Spedizione</span>
                  <span className="text-text">
                    {shippingEur != null ? formatEUR(shippingEur) : "al checkout"}
                  </span>
                </div>

                <div className="mt-4 border-t border-border pt-4 flex items-center justify-between">
                  <span className="text-sm font-extrabold text-text">Totale</span>
                  <span className="text-base font-extrabold text-text">{formatEUR(estimatedTotal)}</span>
                </div>

                <div className="mt-2 text-xs text-muted-text">
                  Consegna: <b>24/48h</b> • Totale stimato (verifica finale su Stripe)
                </div>
              </div>

              <div className="mt-4">
                <Button className="w-full" onClick={() => router.push("/checkout/indirizzo")} disabled={!canGoCheckout}>
                  Vai al checkout
                </Button>
              </div>

              <p className="mt-3 text-xs text-muted-text">
                Inserirai l’indirizzo e vedrai spedizione e totale finali prima del pagamento.
              </p>
            </aside>
          </div>
        )}
      </div>
    </Container>
  );
}