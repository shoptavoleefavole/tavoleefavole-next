"use client";

import { useEffect, useMemo, useState } from "react";

type CartItem = { productId: number; qty: number };

export default function ShippingEstimate({ items }: { items: CartItem[] }) {
  const [zone, setZone] = useState<"IT_MAINLAND" | "IT_ISLANDS">("IT_MAINLAND");
  const [shipping, setShipping] = useState<number | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const payload = useMemo(() => ({ items, zone }), [items, zone]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setErr(null);
      setShipping(null);

      if (!items?.length) {
        setShipping(0);
        setWeight(0);
        return;
      }

      const res = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (cancelled) return;

      if (!res.ok || !data?.ok) {
        setErr(data?.error ?? "Errore calcolo spedizione");
        return;
      }

      setShipping(Number(data.shippingEur));
      setWeight(Number(data.weightTotalGrams));
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [payload, items]);

  return (
    <div className="rounded-xl border p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium">Spedizione</div>
        <select
          className="border rounded-lg px-2 py-1"
          value={zone}
          onChange={(e) => setZone(e.target.value as any)}
        >
          <option value="IT_MAINLAND">Italia - Penisola</option>
          <option value="IT_ISLANDS">Italia - Isole (+2€)</option>
        </select>
      </div>

      <div className="text-sm">
        <div>Consegna: <b>24/48h</b></div>
        {err ? (
          <div className="text-red-600 mt-1">{err}</div>
        ) : shipping === null ? (
          <div className="opacity-70 mt-1">Calcolo in corso…</div>
        ) : (
          <div className="mt-1">
            Costo spedizione: <b>€ {shipping.toFixed(2)}</b>
            {typeof weight === "number" ? (
              <span className="opacity-70"> (peso totale {Math.round(weight)}g)</span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}