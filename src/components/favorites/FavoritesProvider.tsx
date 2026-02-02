"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Ctx = {
  ready: boolean;
  loggedIn: boolean;
  ids: Set<string>; // utile per pagine account
  refresh: () => Promise<void>;
  isFavorite: (productId: string | number) => boolean;
  toggle: (productId: string | number) => Promise<void>;
  isBusy: (productId: string | number) => boolean;
};

const FavoritesCtx = createContext<Ctx | null>(null);

function toKey(id: string | number) {
  return String(id);
}

// ✅ endpoint ufficiale + fallback
const API_ENDPOINTS = ["/api/account/favorite", "/api/account/favorites"] as const;

async function fetchTryEndpoints(build: (base: string) => string, init?: RequestInit) {
  for (const base of API_ENDPOINTS) {
    const url = build(base);
    const res = await fetch(url, { cache: "no-store", credentials: "include", ...init });
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    if (res.status === 404) continue; // prova il prossimo
    return { res, json, used: base };
  }
  return null;
}

export default function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());

  async function load() {
    setReady(false);
    try {
      const result = await fetchTryEndpoints((base) => base, { method: "GET" });

      if (!result || !result.res.ok || result.json?.ok === false) {
        setLoggedIn(false);
        setIds(new Set());
        setReady(true);
        return;
      }

      const arr = Array.isArray(result.json?.favorites) ? result.json.favorites : [];
      const next = new Set<string>();
      for (const f of arr) {
        const pid = f?.product?.id; // qui arriva documentId (string) o id numerico
        if (pid != null) next.add(String(pid));
      }

      setLoggedIn(true);
      setIds(next);
      setReady(true);
    } catch {
      setLoggedIn(false);
      setIds(new Set());
      setReady(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const isFavorite = (productId: string | number) => ids.has(toKey(productId));
  const isBusy = (productId: string | number) => busy.has(toKey(productId));

  async function toggle(productId: string | number) {
    const key = toKey(productId);
    if (busy.has(key)) return;

    setBusy((prev) => new Set(prev).add(key));

    try {
      if (!loggedIn) return;

      const already = ids.has(key);

      if (already) {
        const result = await fetchTryEndpoints(
          (base) => `${base}?productId=${encodeURIComponent(key)}`,
          { method: "DELETE" }
        );

        if (result?.res.ok && result.json?.ok) {
          setIds((prev) => {
            const n = new Set(prev);
            n.delete(key);
            return n;
          });
        }
      } else {
        const result = await fetchTryEndpoints(
          (base) => base,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: key }), // ✅ sempre key
          }
        );

        if (result?.res.ok && result.json?.ok) {
          setIds((prev) => new Set(prev).add(key));
        } else if (result?.res.status === 401) {
          setLoggedIn(false);
        }
      }
    } finally {
      setBusy((prev) => {
        const n = new Set(prev);
        n.delete(key);
        return n;
      });
    }
  }

  const value = useMemo<Ctx>(
    () => ({ ready, loggedIn, ids, refresh: load, isFavorite, toggle, isBusy }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, loggedIn, ids, busy]
  );

  return <FavoritesCtx.Provider value={value}>{children}</FavoritesCtx.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesCtx);
  if (!ctx) throw new Error("useFavorites must be used within <FavoritesProvider>");
  return ctx;
}
