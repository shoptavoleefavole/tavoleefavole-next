"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/lib/types";

export type CartItemMeta = Record<string, any>;

export type CartItem = {
  /** lineId identifica la "riga" del carrello (serve per prodotti personalizzati) */
  lineId: string;
  /** id prodotto (può essere uguale tra righe diverse se cambia meta) */
  id: string;
  slug: string;
  name: string;
  image?: string;
  price: number;
  qty: number;
  /** opzionale: dettagli personalizzazione (materiale, forma, dedica, url immagine, ecc.) */
  meta?: CartItemMeta;
};

type CartSummary = { count: number; total: number };

type AddItemOptions = {
  /** se false, blocca l'inserimento nel carrello (sicurezza) */
  inStock?: boolean;
};

type CartContextValue = {
  items: CartItem[];
  summary: CartSummary;

  /**
   * meta è opzionale:
   * - se assente => comportamento classico (unisce per product.id senza meta)
   * - se presente => unisce solo se product.id + metaKey coincidono, altrimenti nuova riga
   *
   * options:
   * - inStock === false => NON inserisce (a prova di click forzati)
   */
  addItem: (product: Product, qty?: number, meta?: CartItemMeta, options?: AddItemOptions) => void;

  /** rimuove una riga specifica del carrello */
  removeItem: (lineId: string) => void;

  /** aggiorna qty di una riga specifica */
  setQty: (lineId: string, qty: number) => void;

  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

// bump versione per evitare conflitti con vecchi salvataggi
const STORAGE_KEY = "tf_cart_v2";

/* ---------------- Helpers ---------------- */

function toSafeString(v: unknown, fallback = ""): string {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function toSafePrice(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function toSafeQty(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

function stableStringify(obj: any): string {
  // stringify deterministico per generare key stabile
  try {
    if (obj == null) return "";
    if (typeof obj !== "object") return String(obj);

    const seen = new WeakSet();

    const sorter = (value: any): any => {
      if (value == null) return value;
      if (typeof value !== "object") return value;
      if (seen.has(value)) return undefined; // evita cicli
      seen.add(value);

      if (Array.isArray(value)) return value.map(sorter);

      const keys = Object.keys(value).sort();
      const out: Record<string, any> = {};
      for (const k of keys) out[k] = sorter(value[k]);
      return out;
    };

    return JSON.stringify(sorter(obj));
  } catch {
    return "";
  }
}

function buildMetaKey(meta?: CartItemMeta): string {
  if (!meta) return "";
  return stableStringify(meta);
}

function buildLineId(productId: string, metaKey: string): string {
  // lineId stabile: productId + metaKey (accorciato)
  const base = `${productId}::${metaKey}`;
  // hash semplice per non avere stringhe enormi
  let hash = 0;
  for (let idx = 0; idx < base.length; idx++) {
    hash = (hash * 31 + base.charCodeAt(idx)) >>> 0;
  }
  return `${productId}_${hash.toString(16)}`;
}

function sanitizeCartItem(raw: any): CartItem | null {
  if (!raw || typeof raw !== "object") return null;

  const id = toSafeString(raw.id);
  const slug = toSafeString(raw.slug);
  const name = toSafeString(raw.name, "Prodotto");

  const imageRaw = raw.image == null ? "" : toSafeString(raw.image);
  const image = imageRaw ? imageRaw : undefined;

  const price = toSafePrice(raw.price);
  const qty = toSafeQty(raw.qty);

  const meta = raw.meta && typeof raw.meta === "object" ? raw.meta : undefined;
  const metaKey = buildMetaKey(meta);

  const lineId = toSafeString(raw.lineId) || buildLineId(id, metaKey);

  // slug può essere vuoto? per coerenza del tuo shop, lo consideriamo richiesto
  if (!id || !slug) return null;

  return { lineId, id, slug, name, image, price, qty, meta };
}

function parseStoredItems(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);

    // supporto array diretto o oggetto {items:[...]}
    const arr: any[] = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];

    return arr.map(sanitizeCartItem).filter(Boolean) as CartItem[];
  } catch {
    return [];
  }
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/* ---------------- Provider ---------------- */

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // solo per sicurezza/debug (non indispensabile ma ok)
  const hydratingRef = useRef(true);

  // 1) load after mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const loaded = parseStoredItems(window.localStorage.getItem(STORAGE_KEY));
    setItems(loaded);
    setHydrated(true);
    hydratingRef.current = false;
  }, []);

  // 1b) cross-tab sync
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next = parseStoredItems(e.newValue);
      setItems(next);
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // 2) persist after hydrate
  useEffect(() => {
    if (!hydrated) return;
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items, hydrated]);

  const summary = useMemo(() => {
    const count = items.reduce((acc, it) => acc + (Number.isFinite(it.qty) ? it.qty : 0), 0);
    const total = items.reduce(
      (acc, it) =>
        acc +
        (Number.isFinite(it.qty) ? it.qty : 0) * (Number.isFinite(it.price) ? it.price : 0),
      0
    );
    return { count, total: round2(total) };
  }, [items]);

  const addItem: CartContextValue["addItem"] = (product, qty = 1, meta, options) => {
    // ✅ Sicurezza: se non disponibile, non inserire
    if (options?.inStock === false) return;

    const safeQty = toSafeQty(qty);

    // Leggo product in modo tollerante (senza dipendere da campi extra)
    const pid = toSafeString((product as any)?.id);
    const pslug = toSafeString((product as any)?.slug);
    const pname = toSafeString((product as any)?.name, "Prodotto");
    const pimage = (product as any)?.image ? toSafeString((product as any)?.image) : undefined;
    const pprice = toSafePrice((product as any)?.price);

    // sicurezza: niente id/slug => niente carrello
    if (!pid || !pslug) return;

    // sicurezza: se prezzo invalido/non acquistabile, evita inserimento
    if (pprice <= 0) return;

    const metaKey = buildMetaKey(meta);
    const lineId = buildLineId(pid, metaKey);

    setItems((prev) => {
      // Se meta è presente => unisci solo se stessa riga (lineId)
      // Se meta assente => unisci per id (compat comportamento vecchio)
      const match = meta
        ? prev.find((x) => x.lineId === lineId)
        : prev.find((x) => x.id === pid && !x.meta);

      if (match) {
        return prev.map((x) =>
          x.lineId === match.lineId ? { ...x, qty: toSafeQty(x.qty + safeQty) } : x
        );
      }

      const nextItem: CartItem = {
        lineId,
        id: pid,
        slug: pslug,
        name: pname,
        image: pimage,
        price: pprice,
        qty: safeQty,
        meta: meta ? meta : undefined,
      };

      return [...prev, nextItem];
    });
  };

  const removeItem: CartContextValue["removeItem"] = (lineId) => {
    const lid = toSafeString(lineId);
    if (!lid) return;
    setItems((prev) => prev.filter((p) => p.lineId !== lid));
  };

  const setQty: CartContextValue["setQty"] = (lineId, qty) => {
    const lid = toSafeString(lineId);
    if (!lid) return;

    const safeQty = toSafeQty(qty);

    setItems((prev) => prev.map((p) => (p.lineId === lid ? { ...p, qty: safeQty } : p)));
  };

  const clear = () => {
    setItems([]);

    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  };

  const value: CartContextValue = useMemo(
    () => ({ items, summary, addItem, removeItem, setQty, clear }),
    [items, summary]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
