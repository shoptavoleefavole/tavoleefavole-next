"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/lib/types";
import { useCart } from "@/components/cart/CartProvider";

// Nota: usiamo il tipo Product centrale per allinearci al carrello.

function toNumber(v: unknown): number {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function PurchaseBox({ product }: { product: Product }) {
  const [qty, setQty] = useState(1);

  const { addItem } = useCart();

  const price = useMemo(() => toNumber(product.price), [product.price]);
  const compare = useMemo(
    () => (product.compareAtPrice != null ? toNumber(product.compareAtPrice) : null),
    [product.compareAtPrice]
  );
  const hasSale = compare != null && compare > price;

  const inStock = product.inStock !== false;

  function dec() {
    setQty((q) => Math.max(1, q - 1));
  }
  function inc() {
    setQty((q) => Math.min(99, q + 1));
  }

  function onAdd() {
    if (!inStock) return;
    // Normalizziamo il prezzo (se arriva come stringa)
    addItem({ ...product, price }, qty);
  }

  return (
    <aside className="rounded-2xl border border-border bg-background p-4 shadow-sm lg:sticky lg:top-28">
      <div className="flex items-baseline gap-2">
        <div className="text-2xl font-extrabold">€ {price.toFixed(2)}</div>
        {hasSale ? (
          <div className="text-sm text-text/50 line-through">€ {compare!.toFixed(2)}</div>
        ) : null}
      </div>

      {hasSale ? (
        <div className="mt-2 text-sm font-semibold">
          Risparmi € {(compare! - price).toFixed(2)}
        </div>
      ) : null}

      {/* “Spedizione” / trust row (stile e-commerce) */}
      <div className="mt-4 rounded-xl border border-border bg-surface-2/60 px-3 py-2 text-sm">
        <div className="font-semibold">Spedizione</div>
        <div className="text-text/70">Rapida e tracciata</div>
      </div>

      {/* Quantità + Aggiungi (come sulla pagina Deghi: +/- e CTA vicini) :contentReference[oaicite:1]{index=1} */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
        <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
          <button
            type="button"
            onClick={dec}
            className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-surface-2"
            aria-label="Diminuisci quantità"
          >
            –
          </button>

          <input
            value={qty}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n)) return;
              setQty(Math.min(99, Math.max(1, n)));
            }}
            className="w-12 bg-transparent text-center text-sm font-semibold outline-none"
            inputMode="numeric"
            aria-label="Quantità"
          />

          <button
            type="button"
            onClick={inc}
            className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-surface-2"
            aria-label="Aumenta quantità"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={onAdd}
          disabled={!inStock}
          className="w-full rounded-xl px-4 py-3 text-sm font-extrabold shadow-sm transition
                     bg-primary text-primary-contrast hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Aggiungi al carrello
        </button>
      </div>

      {!inStock ? (
        <div className="mt-3 text-sm font-semibold text-red-600">
          Prodotto non disponibile
        </div>
      ) : null}

      {/* Trust pills */}
      <div className="mt-5 grid gap-2 text-sm text-text/80">
        <div className="rounded-xl border border-border px-3 py-2">Pagamenti sicuri</div>
        <div className="rounded-xl border border-border px-3 py-2">Assistenza clienti</div>
      </div>
    </aside>
  );
}
