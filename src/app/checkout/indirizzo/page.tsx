"use client";

import { useEffect, useMemo, useState } from "react";
import Container from "@/components/Container";
import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import { useCart } from "@/components/cart/CartProvider";
import { formatEUR } from "@/lib/format";

type ShippingAddress = {
  address: string;
  city: string;
  postalCode: string;
  province: string;
  country: string;
};

// ✅ Limiti lunghezza centralizzati
const ADDR_LIMITS = {
  address: 200,
  city: 100,
  postalCode: 6,   // 5 cifre + eventuale spazio
  province: 24,
  country: 2,
} as const;

// ✅ Sanitizza ogni campo: trim + truncate (usata sia in load che in save)
function sanitizeAddress(a: ShippingAddress): ShippingAddress {
  return {
    address:    String(a.address    ?? "").trim().slice(0, ADDR_LIMITS.address),
    city:       String(a.city       ?? "").trim().slice(0, ADDR_LIMITS.city),
    postalCode: String(a.postalCode ?? "").replace(/\s+/g, "").slice(0, ADDR_LIMITS.postalCode),
    province:   String(a.province   ?? "").trim().slice(0, ADDR_LIMITS.province),
    country:    (String(a.country ?? "IT").trim().toUpperCase().slice(0, ADDR_LIMITS.country)) || "IT",
  };
}

function loadAddress(): ShippingAddress | null {
  try {
    const raw = localStorage.getItem("tf_shipping_address_v1");
    if (!raw) return null;
    const j = JSON.parse(raw);
    // ✅ Sanitizza al caricamento (dati potrebbero essere stati manipolati)
    return sanitizeAddress({
      address:    String(j?.address    ?? ""),
      city:       String(j?.city       ?? ""),
      postalCode: String(j?.postalCode ?? ""),
      province:   String(j?.province   ?? ""),
      country:    String(j?.country    ?? "IT"),
    });
  } catch {
    return null;
  }
}

function saveAddress(a: ShippingAddress) {
  // ✅ Sanitizza prima di salvare: niente stringhe arbitrariamente lunghe
  localStorage.setItem("tf_shipping_address_v1", JSON.stringify(sanitizeAddress(a)));
}

function capOk(cap: string) {
  return /^\d{5}$/.test(cap.replace(/\s+/g, ""));
}

function clampQty(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(999, Math.floor(n)));
}

function toIntOrNull(v: any): number | null {
  const n = typeof v === "string" ? Number(v.trim()) : Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i > 0 ? i : null;
}

// ✅ Anti open-redirect: accetta solo URL di Stripe Checkout
function isStripeCheckoutUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "checkout.stripe.com" ||
        parsed.hostname.endsWith(".stripe.com"))
    );
  } catch {
    return false;
  }
}

// ✅ Tronca messaggi di errore per evitare rendering di testi molto lunghi
function safeErrMsg(msg: any): string {
  return String(msg ?? "Errore inatteso.").trim().slice(0, 300);
}

export default function CheckoutIndirizzoPage() {
  const { items, summary } = useCart();

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [addr, setAddr] = useState<ShippingAddress>({
    address: "",
    city: "",
    postalCode: "",
    province: "",
    country: "IT",
  });

  useEffect(() => {
    const saved = loadAddress();
    if (saved) setAddr(saved);
  }, []);

  const canSubmit = useMemo(() => {
    return (
      items.length > 0 &&
      addr.address.trim().length >= 3 &&
      addr.city.trim().length >= 2 &&
      capOk(addr.postalCode) &&
      addr.province.trim().length >= 2
    );
  }, [items.length, addr]);

  async function goStripe() {
    if (busy) return;
    setErr(null);

    if (!items.length) {
      setErr("Il carrello è vuoto.");
      return;
    }
    if (!canSubmit) {
      setErr("Compila indirizzo, città, CAP e provincia.");
      return;
    }

    try {
      setBusy(true);

      // ✅ Sanitizza e forza country IT prima di usare i dati
      const clean = sanitizeAddress({ ...addr, country: "IT" });

      saveAddress(clean);

      const payload = {
        items: items.map((it: any) => ({
          id: it.id,
          productId: toIntOrNull(it.productId) ?? toIntOrNull(it.id) ?? undefined,
          slug: it.slug,
          name: it.name,
          price: it.price,                              // ignorato server-side
          qty: clampQty(it.qty),
          imageUrl: it.imageUrl ?? it.image ?? undefined, // ✅ fallback su entrambi i campi
          variantId: it.variantId ?? null,               // ✅ aggiunto: server lo legge
          meta: it.meta ?? undefined,
        })),
        billingType: "PRIVATE",
        billingSnapshot: {
          address:    clean.address,
          city:       clean.city,
          postalCode: clean.postalCode,
          province:   clean.province,
          country:    clean.country,
        },
        shippingAddress: {
          address:    clean.address,
          city:       clean.city,
          postalCode: clean.postalCode,
          province:   clean.province,
          country:    clean.country,
        },
        currency: "EUR",
      };

      const res = await fetch("/api/checkout/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setErr(safeErrMsg(data?.message || data?.error || "Checkout non riuscito."));
        return;
      }

      const url = data?.url;
      if (!url || typeof url !== "string") {
        setErr("URL Stripe mancante.");
        return;
      }

      // ✅ Anti open-redirect: blocca redirect verso URL non Stripe
      if (!isStripeCheckoutUrl(url)) {
        setErr("URL di pagamento non valido. Contattaci.");
        return;
      }

      window.location.href = url;
    } catch (e: any) {
      setErr(safeErrMsg(e?.message || "Errore inatteso."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container>
      <div className="py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-text">Checkout</h1>
            <p className="mt-1 text-sm text-muted-text">
              Inserisci l&apos;indirizzo: calcoliamo spedizione e totale finali.
            </p>
          </div>
          <ButtonLink href="/carrello">Torna al carrello</ButtonLink>
        </div>

        {items.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-border bg-background p-8 text-center">
            <div className="text-base font-semibold text-text">Il carrello è vuoto</div>
            <p className="mt-1 text-sm text-muted-text">Aggiungi un prodotto dal catalogo.</p>
            <div className="mt-6">
              <ButtonLink href="/catalogo">Vai al catalogo</ButtonLink>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
            <section className="rounded-2xl border border-border bg-surface p-5 space-y-4">
              <div className="text-sm font-extrabold text-text">Indirizzo di spedizione</div>

              <label className="block">
                <div className="text-xs font-semibold text-muted-text">Indirizzo</div>
                <input
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  value={addr.address}
                  onChange={(e) => setAddr((s) => ({ ...s, address: e.target.value }))}
                  placeholder="Via/Piazza e numero civico"
                  autoComplete="street-address"
                  maxLength={ADDR_LIMITS.address}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <div className="text-xs font-semibold text-muted-text">Città</div>
                  <input
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    value={addr.city}
                    onChange={(e) => setAddr((s) => ({ ...s, city: e.target.value }))}
                    placeholder="Città"
                    autoComplete="address-level2"
                    maxLength={ADDR_LIMITS.city}
                  />
                </label>

                <label className="block">
                  <div className="text-xs font-semibold text-muted-text">Provincia</div>
                  <input
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    value={addr.province}
                    onChange={(e) => setAddr((s) => ({ ...s, province: e.target.value }))}
                    placeholder="Es. CA oppure Cagliari"
                    maxLength={ADDR_LIMITS.province}
                    autoComplete="address-level1"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <div className="text-xs font-semibold text-muted-text">CAP</div>
                  <input
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    value={addr.postalCode}
                    onChange={(e) => setAddr((s) => ({ ...s, postalCode: e.target.value }))}
                    placeholder="00000"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    maxLength={ADDR_LIMITS.postalCode}
                  />
                </label>

                <label className="block">
                  <div className="text-xs font-semibold text-muted-text">Paese</div>
                  <input
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    value="Italia"
                    readOnly
                    tabIndex={-1}
                    aria-readonly="true"
                  />
                </label>
              </div>

              <div className="text-xs text-muted-text">
                Consegna: <b>24/48h</b>.
              </div>

              {err ? (
                <div role="alert" className="text-sm font-semibold text-red-600">
                  {err}
                </div>
              ) : null}

              <div className="pt-2">
                <Button className="w-full" onClick={goStripe} disabled={!canSubmit || busy}>
                  {busy ? "Apro Stripe…" : "Prosegui al pagamento"}
                </Button>
              </div>
            </section>

            <aside className="h-fit rounded-2xl border border-border bg-surface p-5">
              <div className="text-sm font-extrabold text-text">Riepilogo</div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-text">Articoli</span>
                  <span className="text-text">{summary.count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-text">Totale prodotti</span>
                  <span className="text-text">{formatEUR(summary.total)}</span>
                </div>
                <div className="text-xs text-muted-text mt-2">
                  Spedizione e totale finale verranno mostrati su Stripe prima del pagamento.
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </Container>
  );
}
