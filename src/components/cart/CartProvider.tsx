"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/types";

export type CartItem = {
  id: string;
  slug: string;
  name: string;
  image?: string;
  price: number;
  qty: number;
};

type CartSummary = { count: number; total: number };

type CartContextValue = {
  items: CartItem[];
  summary: CartSummary;
  addItem: (product: Product, qty?: number) => void;
  removeItem: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "tf_cart_v1";

function isCartItem(x: any): x is CartItem {
  return (
    x &&
    typeof x === "object" &&
    typeof x.id === "string" &&
    typeof x.slug === "string" &&
    typeof x.name === "string" &&
    typeof x.image === "string" &&
    typeof x.price === "number" &&
    typeof x.qty === "number"
  );
}

function parseStoredItems(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter(isCartItem)
      .map((it) => ({
        ...it,
        qty: Math.max(1, Number.isFinite(it.qty) ? it.qty : 1),
        price: Number.isFinite(it.price) ? it.price : 0,
      }));
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // 1) load after mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const loaded = parseStoredItems(window.localStorage.getItem(STORAGE_KEY));
    setItems(loaded);
    setHydrated(true);
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
    const count = items.reduce((acc, it) => acc + it.qty, 0);
    const total = items.reduce((acc, it) => acc + it.qty * it.price, 0);
    return { count, total };
  }, [items]);

  const addItem = (product: Product, qty = 1) => {
    const safeQty = Math.max(1, Number.isFinite(qty) ? qty : 1);

    setItems((prev) => {
      const existing = prev.find((p) => p.id === product.id);
      if (existing) {
        return prev.map((p) => (p.id === product.id ? { ...p, qty: p.qty + safeQty } : p));
      }
      return [
        ...prev,
        {
          id: product.id,
          slug: product.slug,
          name: product.name,
          image: product.image,
          price: product.price,
          qty: safeQty,
        },
      ];
    });
  };

  const removeItem = (id: string) => setItems((prev) => prev.filter((p) => p.id !== id));

  const setQty = (id: string, qty: number) => {
    const safeQty = Math.max(1, Number.isFinite(qty) ? qty : 1);
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, qty: safeQty } : p)));
  };

  const clear = () => {
    setItems([]);
    // ✅ svuota anche storage subito (non aspetta l’effetto)
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  };

  const value: CartContextValue = { items, summary, addItem, removeItem, setQty, clear };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
