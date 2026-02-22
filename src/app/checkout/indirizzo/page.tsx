"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Container from "@/components/Container";
import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import { useCart } from "@/components/cart/CartProvider";
import { formatEUR } from "@/lib/format";

type ShippingAddress = {
  address: string;
  city: string;
  postalCode: string;
  province: string; // sigla
  country: string;  // IT
};

function loadAddress(): ShippingAddress | null {
  try {
    const raw = localStorage.getItem("tf_shipping_address_v1");
    if (!raw) return null;
    const j = JSON.parse(raw);
    return {
      address: String(j?.address ?? "").trim(),
      city: String(j?.city ?? "").trim(),
      postalCode: String(j?.postalCode ?? "").trim(),
      province: String(j?.province ?? "").trim(),
      country: String(j?.country ?? "IT").trim() || "IT",
    };
  } catch {
    return null;
  }
}

function saveAddress(a: ShippingAddress) {
  localStorage.setItem("tf_shipping_address_v1", JSON.stringify(a));
}

function capOk(cap: string) {
  const c = cap.replace(/\s+/g, "");
  return /^\d{5}$/.test(c);
}

export default function CheckoutIndirizzoPage() {
  const router = useRouter();
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

      const clean: ShippingAddress = {
        ...addr,
        postalCode: addr.postalCode.replace(/\s+/g, ""),
        province: addr.province.trim().toUpperCase(),
        country: "IT",
      };

      saveAddress(clean);

      const payload = {
        items: items.map((it: any) => ({
          id: it.id,
          productId: typeof it.productId === "number" ? it.productId : undefined,
          slug: it.slug,
          name: it.name,
          price: it.price, // ignorato server-side
          qty: it.qty,
          imageUrl: it.image,
          meta: it.meta ?? undefined,
          lineId: it.lineId,
        })),
        billingType: "PRIVATE",
        billingSnapshot: {
          address: clean.address,
          city: clean.city,
          postalCode: clean.postalCode,
          province: clean.province,
          country: clean.country,
        },
        shippingAddress: {
          address: clean.address,
          city: clean.city,
          postalCode: clean.postalCode,
          province: clean.province,
          country: clean.country,
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
        setErr(data?.message || data?.error || "Checkout non riuscito.");
        return;
      }

      const url = data?.url;
      if (!url) {
        setErr("URL Stripe mancante.");
        return;
      }

      window.location.href = url;
    } catch (e: any) {
      setErr(e?.message ? String(e.message) : "Errore inatteso.");
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
            <p className="mt-1 text-sm text-muted-text">Inserisci l’indirizzo: calcoliamo spedizione e totale finali.</p>
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
                  />
                </label>

                <label className="block">
                  <div className="text-xs font-semibold text-muted-text">Provincia (sigla)</div>
                  <input
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm uppercase"
                    value={addr.province}
                    onChange={(e) => setAddr((s) => ({ ...s, province: e.target.value }))}
                    placeholder="Es. MI, RM, CA, PA…"
                    maxLength={3}
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
                  />
                </label>

                <label className="block">
                  <div className="text-xs font-semibold text-muted-text">Paese</div>
                  <input className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm" value="Italia" readOnly />
                </label>
              </div>

              <div className="text-xs text-muted-text">Consegna: <b>24/48h</b>.</div>

              {err ? <div className="text-sm font-semibold text-red-600">{err}</div> : null}

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