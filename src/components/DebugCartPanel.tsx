"use client";

import { useCart } from "@/components/cart/CartProvider";
import { formatEUR } from "@/lib/format";

export default function DebugCartPanel() {
  const { items, summary, clear } = useCart();

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-text">Carrello (debug)</div>
          <div className="mt-1 text-sm text-muted-text">
            Articoli: {summary.count} — Totale: {formatEUR(summary.total)}
          </div>
        </div>
        <button
          onClick={clear}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-text hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Svuota
        </button>
      </div>

      {items.length === 0 ? (
        <div className="mt-4 text-sm text-muted-text">Carrello vuoto.</div>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-3 rounded-xl bg-background p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-text">{it.name}</div>
                <div className="text-xs text-muted-text">
                  qty {it.qty} × {formatEUR(it.price)}
                </div>
              </div>
              <div className="text-sm font-semibold text-text">{formatEUR(it.qty * it.price)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
