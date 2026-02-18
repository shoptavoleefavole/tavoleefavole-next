"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AddToCartButton from "@/components/cart/AddToCartButton";
import { formatEUR } from "@/lib/format";

type Product = {
  id: string;
  documentId?: string;
  slug: string;
  name: string;
  price: number | string;
  compareAtPrice?: number | string | null;
  image?: string;
  imageUrl?: string;
  isNew?: boolean;

  // legacy/fallback
  inStock?: boolean;

  // inventario
  stockQty?: number | null;
  trackInventory?: boolean | null;

  popularity?: number;
  createdAt?: string; // ISO string
};

type SortValue = "popularity" | "price_asc" | "price_desc" | "newest";

const MAX_Q_LEN = 80;

function toNumber(v: unknown): number {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toTime(v: unknown): number {
  if (typeof v !== "string") return 0;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

function toIntOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

function isBool(v: unknown): v is boolean {
  return typeof v === "boolean";
}

function sanitizeText(input: unknown, maxLen: number) {
  const s = String(input ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

/**
 * Protegge da URL strane (javascript:, data:, ecc.)
 * Consente solo http/https e path relativo "/..."
 */
function safeImageSrc(u: unknown): string {
  const raw = String(u ?? "").trim();
  if (!raw) return "/brand/tavoleefavole-logo.svg";
  if (raw.startsWith("/")) return raw;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.toString();
  } catch {
    // ignore
  }

  return "/brand/tavoleefavole-logo.svg";
}

/**
 * Regola disponibilità:
 * - trackInventory=false => sempre disponibile
 * - trackInventory=true e stockQty numero => disponibile solo se stockQty>0
 * - altrimenti fallback su inStock
 * - default finale: true
 */
function isProductInStock(p: Product): boolean {
  const track = p.trackInventory !== false;
  const qty = toIntOrNull(p.stockQty);

  if (!track) return true;
  if (typeof qty === "number") return qty > 0;
  if (isBool(p.inStock)) return p.inStock;
  return true;
}

export default function ProductsGridWithFilters({
  items,
  emptyText = "Nessun prodotto trovato.",
  initialQuery = "",
}: {
  items: Product[];
  emptyText?: string;
  initialQuery?: string;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "/catalogo";
  const searchParams = useSearchParams();

  const [q, setQ] = useState(() => sanitizeText(searchParams.get("q") ?? initialQuery, MAX_Q_LEN));

  const [inStockOnly, setInStockOnly] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const [saleOnly, setSaleOnly] = useState(false);

  const [sort, setSort] = useState<SortValue>(() => {
    const raw = (searchParams.get("sort") ?? "popularity").toLowerCase();
    if (raw === "price_asc") return "price_asc";
    if (raw === "price_desc") return "price_desc";
    if (raw === "newest") return "newest";
    return "popularity";
  });

  useEffect(() => {
    const urlQ = sanitizeText(searchParams.get("q") ?? "", MAX_Q_LEN);
    if (urlQ !== q) setQ(urlQ);

    const raw = (searchParams.get("sort") ?? "popularity").toLowerCase();
    const nextSort: SortValue =
      raw === "price_asc" ? "price_asc" : raw === "price_desc" ? "price_desc" : raw === "newest" ? "newest" : "popularity";

    if (nextSort !== sort) setSort(nextSort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function setParam(key: string, value: string | null) {
    const sp = new URLSearchParams(searchParams.toString());
    if (!value) sp.delete(key);
    else sp.set(key, value);

    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function onChangeSort(next: SortValue) {
    setSort(next);
    setParam("sort", next === "popularity" ? null : next);
  }

  function resetFilters() {
    setQ("");
    setInStockOnly(false);
    setNewOnly(false);
    setSaleOnly(false);
    setSort("popularity");

    setParam("q", null);
    setParam("sort", null);
  }

  const hasActiveFilters = useMemo(() => {
    return q.trim().length > 0 || inStockOnly || newOnly || saleOnly || sort !== "popularity";
  }, [q, inStockOnly, newOnly, saleOnly, sort]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    let list = items.filter((p) => {
      const name = String(p?.name ?? "");
      if (query && !name.toLowerCase().includes(query)) return false;

      const inStock = isProductInStock(p);
      if (inStockOnly && !inStock) return false;

      if (newOnly && !p.isNew) return false;

      const hasSale = p.compareAtPrice != null && toNumber(p.compareAtPrice) > toNumber(p.price);
      if (saleOnly && !hasSale) return false;

      return true;
    });

    switch (sort) {
      case "price_asc":
        list = [...list].sort((a, b) => toNumber(a.price) - toNumber(b.price));
        break;

      case "price_desc":
        list = [...list].sort((a, b) => toNumber(b.price) - toNumber(a.price));
        break;

      case "newest":
        list = [...list].sort((a, b) => {
          const ta = toTime((a as any).createdAt);
          const tb = toTime((b as any).createdAt);
          if (ta !== 0 || tb !== 0) return tb - ta;

          const na = Number(!!a.isNew);
          const nb = Number(!!b.isNew);
          if (na !== nb) return nb - na;

          return String(b.id).localeCompare(String(a.id));
        });
        break;

      case "popularity":
      default:
        list = [...list].sort((a, b) => {
          const pa = Number((a as any).popularity ?? 0);
          const pb = Number((b as any).popularity ?? 0);
          if (pa !== pb) return pb - pa;

          const sa = Number(isProductInStock(a));
          const sb = Number(isProductInStock(b));
          if (sa !== sb) return sb - sa;

          return String(a.id).localeCompare(String(b.id));
        });
        break;
    }

    return list;
  }, [items, q, inStockOnly, newOnly, saleOnly, sort]);

  return (
    <div className="mt-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={q}
            onChange={(e) => {
              const next = sanitizeText(e.target.value, MAX_Q_LEN);
              setQ(next);
              setParam("q", next.trim() ? next : null);
            }}
            placeholder="Cerca un prodotto…"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25 sm:w-72"
            inputMode="search"
            maxLength={MAX_Q_LEN}
          />

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-surface-2">
              <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
              Disponibili
            </label>

            <label className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-surface-2">
              <input type="checkbox" checked={newOnly} onChange={(e) => setNewOnly(e.target.checked)} />
              Novità
            </label>

            <label className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-surface-2">
              <input type="checkbox" checked={saleOnly} onChange={(e) => setSaleOnly(e.target.checked)} />
              In offerta
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
          <div className="text-sm text-text/70">
            {filtered.length} / {items.length}
          </div>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold hover:bg-surface-2"
            >
              Reset filtri
            </button>
          ) : null}

          <select
            value={sort}
            onChange={(e) => onChangeSort(e.target.value as SortValue)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            aria-label="Ordina prodotti"
          >
            <option value="popularity">Popolarità</option>
            <option value="price_asc">Prezzo crescente</option>
            <option value="price_desc">Prezzo decrescente</option>
            <option value="newest">Novità</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm font-semibold">{emptyText}</p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover"
            >
              Rimuovi filtri
            </button>
          ) : (
            <p className="mt-2 text-sm text-text/70">Prova a cambiare ricerca o scegli un’altra categoria.</p>
          )}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => {
            const price = toNumber(p.price);
            const compare = p.compareAtPrice != null ? toNumber(p.compareAtPrice) : null;
            const hasSale = compare != null && compare > price;

            const id = String((p as any).documentId ?? p.documentId ?? p.id ?? p.slug);
            const slug = String(p.slug ?? p.id ?? "");

            const image = safeImageSrc((p as any).imageUrl ?? p.imageUrl ?? p.image);

            const inStock = isProductInStock(p);
            const notBuyable = price <= 0;
            const isDisabled = !inStock || notBuyable;

            return (
              <div
                key={id}
                className="rounded-2xl border border-border bg-background p-3 hover:shadow-sm flex h-full flex-col"
              >
                <Link href={`/prodotto/${slug}`} className="block">
                  <div className="aspect-[4/3] overflow-hidden rounded-xl bg-surface-2/60">
                    <img src={image} alt={String(p.name ?? "")} className="h-full w-full object-cover" loading="lazy" />
                  </div>

                  <div className="mt-3">
                    <div className="text-sm font-semibold line-clamp-2">{p.name}</div>
                  </div>
                </Link>

                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-sm font-bold">{formatEUR(price)}</span>
                  {hasSale ? <span className="text-xs line-through text-text/50">{formatEUR(compare!)}</span> : null}
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {p.isNew ? (
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs font-semibold">Novità</span>
                  ) : null}
                  {hasSale ? (
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs font-semibold">Offerta</span>
                  ) : null}
                  {!inStock ? (
                    <span className="rounded-full border border-red-200 px-2 py-0.5 text-xs font-semibold text-red-600">
                      Non disponibile
                    </span>
                  ) : null}
                </div>

                <div className="mt-auto pt-3">
                  <AddToCartButton
                    id={id}
                    slug={slug}
                    name={String(p.name ?? "")}
                    image={image}
                    price={price}
                    qty={1}
                    inStock={inStock}
                    disabled={isDisabled}
                    disabledLabel={notBuyable ? "Non acquistabile" : "Esaurito"}
                    className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm font-extrabold hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    stockQty={typeof p.stockQty === "number" ? p.stockQty : undefined}
                    trackInventory={typeof p.trackInventory === "boolean" ? p.trackInventory : undefined}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
