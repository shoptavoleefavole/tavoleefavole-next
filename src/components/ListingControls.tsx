"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

function setParam(params: URLSearchParams, key: string, value: string | null) {
  const next = new URLSearchParams(params.toString());
  if (value === null || value === "") next.delete(key);
  else next.set(key, value);
  return next;
}

export default function ListingControls() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const sort = params.get("sort") ?? "pop";
  const inStock = params.get("inStock") === "1";
  const onSale = params.get("onSale") === "1";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={inStock}
            onChange={(e) => router.push(`${pathname}?${setParam(params as any, "inStock", e.target.checked ? "1" : null).toString()}`)}
          />
          <span>Disponibili</span>
        </label>

        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={onSale}
            onChange={(e) => router.push(`${pathname}?${setParam(params as any, "onSale", e.target.checked ? "1" : null).toString()}`)}
          />
          <span>In promo</span>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-text">Ordina</span>
        <select
          value={sort}
          onChange={(e) => router.push(`${pathname}?${setParam(params as any, "sort", e.target.value).toString()}`)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Ordina prodotti"
        >
          <option value="pop">Popolari (mock)</option>
          <option value="price-asc">Prezzo: crescente</option>
          <option value="price-desc">Prezzo: decrescente</option>
          <option value="name-asc">Nome: A-Z</option>
        </select>
      </div>
    </div>
  );
}
