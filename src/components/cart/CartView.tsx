"use client";
/* eslint-disable react/no-unescaped-entities */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Container from "@/components/Container";
import Button from "@/components/ui/Button";
import { useCart } from "@/components/cart/CartProvider";
import { formatEUR } from "@/lib/format";

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

function normalizeImageUrl(raw: unknown): string {
  const s = safeString(raw, "");
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("data:") || s.startsWith("blob:")) return s;
  if (s.startsWith("/brand/") || s.startsWith("/placeholder") || s.startsWith("/images/")) return s;
  if (s.startsWith("/uploads/") && STRAPI_PUBLIC_URL) return `${STRAPI_PUBLIC_URL}${s}`;
  return s;
}

function SafeImg({
  src, alt, className, fallbackSrc = "/brand/tavoleefavole-logo.svg", timeoutMs = 7000,
}: { src?: string; alt: string; className?: string; fallbackSrc?: string; timeoutMs?: number }) {
  const [currentSrc, setCurrentSrc] = useState<string>(normalizeImageUrl(src) || fallbackSrc);
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
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); timerRef.current = null; };
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
        if (timerRef.current) {
          window.clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      }}
      onError={() => {
        loadedRef.current = true;
        if (timerRef.current) {
          window.clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        if (currentSrc !== fallbackSrc) setCurrentSrc(fallbackSrc);
      }}
    />
  );
}

function TruckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M2.5 4.5h9v9h-9v-9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M11.5 7.5h3.2l2 2.3v3.7h-5.2V7.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M6.2 15.8a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM14.3 15.8a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" fill="currentColor" />
    </svg>
  );
}

type AddressForm = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  province: string;
  country: string;
};

function emptyForm(): AddressForm {
  return { fullName: "", email: "", phone: "", address: "", postalCode: "", city: "", province: "", country: "IT" };
}

function capOk(cap: string) {
  const c = String(cap || "").replace(/\s+/g, "");
  return /^\d{5}$/.test(c);
}

function validateShippingForm(f: AddressForm): string | null {
  if (!f.address.trim() || f.address.trim().length < 3) return "Inserisci l'indirizzo di spedizione.";
  if (!capOk(f.postalCode)) return "CAP non valido (5 cifre).";
  if (!f.city.trim() || f.city.trim().length < 2) return "Inserisci la città.";
  if (!f.province.trim() || f.province.trim().length < 2) return "Inserisci la provincia.";
  return null;
}

function isFormTouched(f: AddressForm): boolean {
  return !!(f.address.trim() || f.postalCode.trim() || f.city.trim());
}

type Quote = {
  ok: boolean;
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
    discountedSubtotal?: number;
    discountTotal: number;
    shippingTotal: number;
    total: number;
    currency: string;
    freeShippingThreshold?: number;
    qualifiesForFreeShipping?: boolean;
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

function FormField({
  label, value, onChange, placeholder, type = "text", required = false, error,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean; error?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-text/70 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`h-10 w-full rounded-xl border px-3 text-sm bg-background transition-colors ${error ? "border-red-400 focus:border-red-500" : "border-border focus:border-primary"} outline-none`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function CartView() {
  const { items, summary, removeItem, setQty, clear } = useCart();

  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const quoteAbortRef = useRef<AbortController | null>(null);

  const [shippingForm, setShippingForm] = useState<AddressForm>(emptyForm());
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [billingForm, setBillingForm] = useState<AddressForm>(emptyForm());
  const [formTouched, setFormTouched] = useState(false);

  const [shippingQuoteBusy, setShippingQuoteBusy] = useState(false);
  const [shippingQuoteError, setShippingQuoteError] = useState<string | null>(null);
  const [shippingEur, setShippingEur] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetchWithTimeout("/api/account/profile", {
          method: "GET",
          credentials: "include",
          timeoutMs: 8_000,
          headers: { Accept: "application/json" },
        });
        const data = await res.json().catch(() => null);
        if (cancelled || !res.ok || !data?.ok) return;

        const sa = data.shippingAddress;
        const ba = data.billingAddress;

        if (sa?.address) {
          setShippingForm((prev) => ({
            ...prev,
            address: sa.address || "",
            postalCode: sa.postalCode || "",
            city: sa.city || "",
            province: sa.province || "",
            country: sa.country || "IT",
          }));
        }

        if (ba?.address && ba.address !== sa?.address) {
          setBillingForm((prev) => ({
            ...prev,
            address: ba.address || "",
            postalCode: ba.postalCode || "",
            city: ba.city || "",
            province: ba.province || "",
            country: ba.country || "IT",
          }));
          setBillingSameAsShipping(false);
        }
      } catch {
        // guest: nessun errore mostrato
      }
    }
    run();
    return () => { cancelled = true; };
  }, []);

  const updateShipping = (field: keyof AddressForm) => (value: string) => {
    setShippingForm((prev) => ({ ...prev, [field]: value }));
    setFormTouched(true);
  };

  const updateBilling = (field: keyof AddressForm) => (value: string) => {
    setBillingForm((prev) => ({ ...prev, [field]: value }));
  };

  const shippingAddressForQuote = useMemo(() => ({
    address: shippingForm.address,
    city: shippingForm.city,
    postalCode: shippingForm.postalCode,
    province: shippingForm.province,
    country: shippingForm.country || "IT",
  }), [shippingForm]);

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
          setQuote({ ok: false, error: data?.error || `Quote fallita (HTTP ${res.status})` });
          return;
        }

        setQuote(data);
      } catch (e: any) {
        if (e?.name === "AbortError") {
          setQuote({ ok: false, error: "Timeout: aggiornamento prezzi troppo lento." });
          return;
        }
        setQuote({ ok: false, error: e?.message ? String(e.message) : "Errore quote" });
      }
    };

    run();
    return () => controller.abort();
  }, [items]);

  useEffect(() => {
    let cancelled = false;
    if (!items.length) {
      setShippingEur(null);
      setShippingQuoteError(null);
      return;
    }

    const formError = validateShippingForm(shippingForm);
    if (formError) {
      setShippingEur(null);
      if (formTouched && isFormTouched(shippingForm)) setShippingQuoteError(formError);
      else setShippingQuoteError(null);
      return;
    }

    async function run() {
      setShippingQuoteError(null);
      setShippingEur(null);
      try {
        setShippingQuoteBusy(true);
        const payload = {
          shippingAddress: shippingAddressForQuote,
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
          setShippingQuoteError("Spedizione non disponibile per questo indirizzo.");
          return;
        }
        const eur = Number(data.shippingEur);
        if (!Number.isFinite(eur) || eur < 0) {
          setShippingQuoteError("Spedizione non disponibile.");
          return;
        }
        setShippingEur(eur);
      } catch {
        if (!cancelled) setShippingQuoteError("Spedizione non disponibile.");
      } finally {
        if (!cancelled) setShippingQuoteBusy(false);
      }
    }

    run();
    return () => { cancelled = true; };
  }, [items, shippingForm, shippingAddressForQuote, formTouched]);

  const quoteMap = useMemo(() => {
    const map = new Map<string, NonNullable<Quote["pricedItems"]>[number]>();
    for (const qi of quote?.pricedItems ?? []) {
      if (qi.lineId) map.set(qi.lineId, qi);
    }
    return map;
  }, [quote]);

  const originalSubtotal =
    typeof quote?.totals?.subtotal === "number"
      ? quote.totals.subtotal
      : safeNumber(summary.total, 0);

  const discountedSubtotal =
    typeof quote?.totals?.discountedSubtotal === "number"
      ? quote.totals.discountedSubtotal
      : originalSubtotal;

  const discountTotal =
    typeof quote?.totals?.discountTotal === "number"
      ? quote.totals.discountTotal
      : Math.max(0, originalSubtotal - discountedSubtotal);

  const qualifiesForFreeShipping = quote?.totals?.qualifiesForFreeShipping === true;
  const freeShippingThreshold =
    typeof quote?.totals?.freeShippingThreshold === "number"
      ? quote.totals.freeShippingThreshold
      : 79;

  const effectiveShippingEur =
    qualifiesForFreeShipping
      ? 0
      : typeof shippingEur === "number"
        ? shippingEur
        : null;

  const estimatedTotal = discountedSubtotal + (effectiveShippingEur ?? 0);

  const shippingFormError = validateShippingForm(shippingForm);

  const canCheckout =
    items.length > 0 &&
    !checkoutBusy &&
    !shippingFormError &&
    shippingEur !== null &&
    !shippingQuoteBusy &&
    !shippingQuoteError;

  async function startCheckout() {
    if (!canCheckout) return;
    setCheckoutError(null);

    try {
      setCheckoutBusy(true);
      const effBilling = billingSameAsShipping ? shippingForm : billingForm;

      const payload = {
        items: items.map((it: any) => ({
          id: it.id,
          productId: toIntOrNull(it.productId) ?? toIntOrNull(it.id) ?? undefined,
          slug: it.slug,
          name: it.name,
          price: safeNumber(it.price, 0),
          qty: clampQty(it.qty),
          imageUrl: it.image,
          meta: it.meta ?? undefined,
          lineId: it.lineId,
        })),
        billingType: "PRIVATE",
        billingSnapshot: {
          firstName: effBilling.fullName.split(" ")[0] || "",
          lastName: effBilling.fullName.split(" ").slice(1).join(" ") || "",
          email: shippingForm.email || "",
          phone: shippingForm.phone || "",
          address: effBilling.address,
          city: effBilling.city,
          postalCode: String(effBilling.postalCode).replace(/\s+/g, ""),
          province: effBilling.province,
          country: effBilling.country || "IT",
        },
        shippingAddress: {
          address: shippingForm.address,
          city: shippingForm.city,
          postalCode: String(shippingForm.postalCode).replace(/\s+/g, ""),
          province: shippingForm.province,
          country: shippingForm.country || "IT",
        },
        customerEmail: shippingForm.email || undefined,
        currency: "EUR",
      };

      const res = await fetchWithTimeout("/api/checkout/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
        timeoutMs: 20_000,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setCheckoutError(data?.message || data?.error || "Checkout non riuscito.");
        return;
      }

      const url = data?.url;
      if (!url || typeof url !== "string") {
        setCheckoutError("Checkout non riuscito: URL Stripe mancante.");
        return;
      }

      window.location.href = url;
    } catch (e: any) {
      setCheckoutError(e?.message ? String(e.message) : "Errore durante il checkout.");
    } finally {
      setTimeout(() => setCheckoutBusy(false), 250);
    }
  }

  return (
    <Container>
      <div className="py-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-text">Carrello</h1>
            <p className="mt-1 text-sm text-muted-text">Rivedi i prodotti e completa l&apos;ordine in pochi passaggi.</p>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={clear}
              className="text-sm font-semibold text-link hover:text-link-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Svuota carrello
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-border bg-background p-8 text-center">
            <div className="text-base font-semibold text-text">Il carrello è vuoto</div>
            <p className="mt-1 text-sm text-muted-text">Aggiungi un prodotto dal catalogo per iniziare.</p>
            <div className="mt-6">
              <Link href="/catalogo" className="font-semibold underline">Vai al catalogo</Link>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]">
            <section aria-label="Articoli" className="space-y-4">
              {items.map((it: any) => {
                const slug = safeString(it.slug);
                const isLinkable = !!slug;
                const qi = it.lineId ? quoteMap.get(it.lineId) : undefined;
                const unit = typeof qi?.unitPrice === "number" ? qi.unitPrice : safeNumber(it.price, 0);
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
                          <div className="mt-1 text-sm font-extrabold text-text">{formatEUR(unit)}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(it.lineId)}
                          className="shrink-0 rounded-xl px-3 py-2 text-sm font-semibold text-text hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                              className="h-10 w-10 grid place-items-center hover:bg-surface-2"
                            >
                              <span className="text-lg leading-none">−</span>
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={clampQty(it.qty)}
                              onChange={(e) => setQty(it.lineId, clampQty(e.target.value))}
                              className="h-10 w-16 border-x border-border bg-background px-2 text-center text-sm"
                              inputMode="numeric"
                            />
                            <button
                              type="button"
                              onClick={() => setQty(it.lineId, clampQty(it.qty) + 1)}
                              className="h-10 w-10 grid place-items-center hover:bg-surface-2"
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

            <aside className="space-y-4">
              <div className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background">
                    <TruckIcon />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-extrabold text-text">Consegna rapida 24/48h</div>
                    <div className="mt-1 text-sm text-text/70">
                      Compila l&apos;indirizzo per calcolare la spedizione.
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background p-5">
                <div className="text-sm font-extrabold text-text mb-4">Dati di spedizione</div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <FormField
                        label="Nome e cognome"
                        value={shippingForm.fullName}
                        onChange={updateShipping("fullName")}
                        placeholder="Mario Rossi"
                      />
                    </div>
                    <div className="col-span-2">
                      <FormField
                        label="Indirizzo"
                        value={shippingForm.address}
                        required
                        onChange={updateShipping("address")}
                        placeholder="Via Roma, 1"
                      />
                    </div>
                    <FormField
                      label="CAP"
                      value={shippingForm.postalCode}
                      required
                      onChange={updateShipping("postalCode")}
                      placeholder="00100"
                    />
                    <FormField
                      label="Città"
                      value={shippingForm.city}
                      required
                      onChange={updateShipping("city")}
                      placeholder="Roma"
                    />
                    <FormField
                      label="Provincia"
                      value={shippingForm.province}
                      required
                      onChange={updateShipping("province")}
                      placeholder="RM"
                    />
                    <FormField
                      label="Stato"
                      value={shippingForm.country}
                      onChange={updateShipping("country")}
                      placeholder="IT"
                    />
                    <div className="col-span-2">
                      <FormField
                        label="Email (per ricevuta)"
                        value={shippingForm.email}
                        onChange={updateShipping("email")}
                        placeholder="nome@email.it"
                        type="email"
                      />
                    </div>
                    <div className="col-span-2">
                      <FormField
                        label="Telefono (opzionale)"
                        value={shippingForm.phone}
                        onChange={updateShipping("phone")}
                        placeholder="+39 333 000 0000"
                        type="tel"
                      />
                    </div>
                  </div>

                  {shippingQuoteBusy && (
                    <p className="text-xs text-muted-text">Calcolo spedizione…</p>
                  )}
                  {!shippingQuoteBusy && shippingQuoteError && formTouched && (
                    <p className="text-xs font-semibold text-red-600">{shippingQuoteError}</p>
                  )}
                  {!shippingQuoteBusy && shippingEur !== null && qualifiesForFreeShipping && (
                    <p className="text-xs font-semibold text-green-700">
                      ✓ Spedizione gratuita applicata sopra {formatEUR(freeShippingThreshold)}
                    </p>
                  )}
                  {!shippingQuoteBusy && shippingEur !== null && !qualifiesForFreeShipping && (
                    <p className="text-xs font-semibold text-green-700">
                      ✓ Spedizione disponibile: {formatEUR(shippingEur)}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="text-sm font-extrabold text-text">Dati di fatturazione</div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={billingSameAsShipping}
                      onChange={(e) => setBillingSameAsShipping(e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <span className="text-xs text-muted-text">Uguale a spedizione</span>
                  </label>
                </div>

                {billingSameAsShipping ? (
                  <p className="text-xs text-muted-text">
                    Useremo l&apos;indirizzo di spedizione anche per la fattura.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <FormField
                          label="Indirizzo fatturazione"
                          value={billingForm.address}
                          required
                          onChange={updateBilling("address")}
                          placeholder="Via Roma, 1"
                        />
                      </div>
                      <FormField
                        label="CAP"
                        value={billingForm.postalCode}
                        required
                        onChange={updateBilling("postalCode")}
                        placeholder="00100"
                      />
                      <FormField
                        label="Città"
                        value={billingForm.city}
                        required
                        onChange={updateBilling("city")}
                        placeholder="Roma"
                      />
                      <FormField
                        label="Provincia"
                        value={billingForm.province}
                        required
                        onChange={updateBilling("province")}
                        placeholder="RM"
                      />
                      <FormField
                        label="Stato"
                        value={billingForm.country}
                        onChange={updateBilling("country")}
                        placeholder="IT"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-surface p-5">
                <div className="text-sm font-extrabold text-text">Riepilogo ordine</div>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-text">Articoli</span>
                    <span className="text-text">{summary.count}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-text">Subtotale iniziale</span>
                    <span className="text-text">{formatEUR(originalSubtotal)}</span>
                  </div>

                  {discountTotal > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-text">Sconto</span>
                      <span className="text-green-700">− {formatEUR(discountTotal)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-muted-text">Subtotale scontato</span>
                    <span className="text-text">{formatEUR(discountedSubtotal)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-text">Spedizione</span>
                    <span className="text-text">
                      {shippingQuoteBusy
                        ? "Calcolo…"
                        : effectiveShippingEur != null
                          ? qualifiesForFreeShipping
                            ? "Gratis"
                            : formatEUR(effectiveShippingEur)
                          : "—"}
                    </span>
                  </div>

                  <div className="mt-4 border-t border-border pt-4 flex items-center justify-between">
                    <span className="text-sm font-extrabold text-text">Totale</span>
                    <span className="text-base font-extrabold text-text">{formatEUR(estimatedTotal)}</span>
                  </div>

                  <div className="mt-2 text-xs text-muted-text">
                    Consegna: <b>24/48h</b>
                  </div>

                  {qualifiesForFreeShipping && (
                    <div className="text-xs font-semibold text-green-700">
                      Spedizione gratuita applicata sopra {formatEUR(freeShippingThreshold)}.
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <Button className="w-full" onClick={startCheckout} disabled={!canCheckout}>
                    {checkoutBusy ? "Apro Stripe…" : "Vai al checkout"}
                  </Button>
                </div>

                {checkoutError ? (
                  <p className="mt-3 text-xs font-semibold text-red-600">{checkoutError}</p>
                ) : !canCheckout && formTouched ? (
                  <p className="mt-3 text-xs text-muted-text">Completa i campi obbligatori per continuare.</p>
                ) : !canCheckout ? (
                  <p className="mt-3 text-xs text-muted-text">Inserisci l&apos;indirizzo di spedizione per continuare.</p>
                ) : (
                  <p className="mt-3 text-xs text-muted-text">Verrai reindirizzato al checkout sicuro Stripe.</p>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </Container>
  );
}