"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Favorite = {
  id: string;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
  };
};

const API_ENDPOINTS = ["/api/account/favorite", "/api/account/favorites"] as const;

function safeMoney(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return "0.00";
  return n.toFixed(2);
}

function toStrId(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function normalizeFavorites(json: unknown): Favorite[] {
  const j = (json ?? {}) as any;
  const raw: any[] =
    (Array.isArray(j?.favorites) && j.favorites) ||
    (Array.isArray(j?.data) && j.data) ||
    [];

  const out: Favorite[] = [];

  for (const item of raw) {
    const favId = toStrId(item?.id ?? item?.documentId ?? item?._id);
    if (!favId) continue;

    const p = item?.product ?? item?.attributes?.product ?? item?.data?.product ?? null;
    const productId = toStrId(p?.id ?? p?.documentId ?? p?._id);
    const slug = toStrId(p?.slug);
    const name = toStrId(p?.name ?? p?.Titolo ?? p?.title);

    if (!productId || !slug || !name) continue;

    const priceNum = Number(p?.price ?? 0);

    out.push({
      id: favId,
      product: {
        id: productId,
        name,
        slug,
        price: Number.isFinite(priceNum) && priceNum >= 0 ? priceNum : 0,
      },
    });
  }

  return out;
}

function prettyError(res: Response, json: any): string {
  if (res.status === 401) return "Devi accedere per vedere i preferiti.";
  if (res.status === 403) return "Non hai i permessi per questa operazione.";
  if (res.status === 429) return "Troppe richieste. Riprova tra poco.";
  const serverMsg = json?.message || json?.error ? String(json.message || json.error) : "";
  return serverMsg || `Errore (HTTP ${res.status})`;
}

async function fetchJsonTryEndpoints(
  buildUrl: (base: string) => string,
  init: RequestInit,
  signal: AbortSignal
): Promise<{ res: Response; json: any; used: string } | null> {
  for (const base of API_ENDPOINTS) {
    const url = buildUrl(base);

    const res = await fetch(url, {
      ...init,
      signal,
      cache: "no-store",
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(init.headers || {}),
      },
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (res.status === 404) continue; // endpoint non esiste, prova l’altro
    return { res, json, used: base };
  }

  return null;
}

export default function FavoritesPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [removingProductId, setRemovingProductId] = useState<string | null>(null);

  // evita setState dopo unmount + abort fetch pendenti
  const aliveRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setErr("");

    try {
      const result = await fetchJsonTryEndpoints(
        (base) => base,
        { method: "GET" },
        controller.signal
      );

      if (!aliveRef.current) return;

      if (!result) {
        setFavorites([]);
        setErr("Endpoint preferiti non trovato (né /favorite né /favorites).");
        setLoading(false);
        return;
      }

      const { res, json } = result;

      if (!res.ok || json?.ok === false) {
        setFavorites([]);
        setErr(prettyError(res, json));
        setLoading(false);
        return;
      }

      setFavorites(normalizeFavorites(json));
      setLoading(false);
    } catch (e: any) {
      if (!aliveRef.current) return;
      if (e?.name === "AbortError") return; // navigazione/refresh rapido
      setFavorites([]);
      setErr(e?.message || "Errore di rete");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const count = useMemo(() => favorites.length, [favorites]);

  const remove = useCallback(
    async (productId: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setRemovingProductId(productId);
      setErr("");

      try {
        const result = await fetchJsonTryEndpoints(
          (base) => `${base}?productId=${encodeURIComponent(productId)}`,
          { method: "DELETE" },
          controller.signal
        );

        if (!aliveRef.current) return;

        if (!result) {
          setErr("Endpoint rimozione preferiti non trovato.");
          setRemovingProductId(null);
          return;
        }

        const { res, json } = result;

        if (!res.ok || json?.ok === false) {
          setErr(prettyError(res, json));
          setRemovingProductId(null);
          return;
        }

        await load();
        if (!aliveRef.current) return;
        setRemovingProductId(null);
      } catch (e: any) {
        if (!aliveRef.current) return;
        if (e?.name === "AbortError") return;
        setErr(e?.message || "Errore di rete");
        setRemovingProductId(null);
      }
    },
    [load]
  );

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ fontSize: 40, fontWeight: 800, marginBottom: 12 }}>Preferiti</h1>
        <Link href="/account" style={{ fontWeight: 800 }}>
          ← Account
        </Link>
      </div>

      <div style={{ opacity: 0.75, marginTop: 6 }}>
        Totale: <b>{count}</b>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 800,
          }}
        >
          {loading ? "Aggiorno..." : "Ricarica"}
        </button>

        <Link
          href="/catalogo"
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            fontWeight: 800,
            display: "inline-block",
          }}
        >
          Vai al catalogo
        </Link>
      </div>

      {loading && <p style={{ marginTop: 12 }}>Caricamento…</p>}

      {!loading && err && (
        <div style={{ marginTop: 12 }}>
          <p style={{ color: "crimson", marginBottom: 8 }}>❌ {err}</p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={load}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              Riprova
            </button>

            <Link
              href="/account/login"
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                fontWeight: 800,
                display: "inline-block",
              }}
            >
              Vai al login
            </Link>
          </div>
        </div>
      )}

      {!loading && !err && favorites.length === 0 && (
        <div style={{ marginTop: 12 }}>
          <p>Non hai ancora aggiunto preferiti.</p>
          <p style={{ opacity: 0.75, marginTop: 6 }}>
            Vai al catalogo e clicca sul ❤️ per aggiungere prodotti ai preferiti.
          </p>
        </div>
      )}

      {!loading && !err && favorites.length > 0 && (
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {favorites.map((f) => (
            <div key={f.id} style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{f.product.name}</div>
                  <div style={{ opacity: 0.75, marginTop: 4 }}>€ {safeMoney(f.product.price)}</div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Link
                    href={`/prodotto/${f.product.slug}`}
                    style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd" }}
                  >
                    Vedi prodotto
                  </Link>

                  <button
                    onClick={() => remove(f.product.id)}
                    disabled={removingProductId === f.product.id}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid #ddd",
                      cursor: removingProductId === f.product.id ? "not-allowed" : "pointer",
                      fontWeight: 800,
                    }}
                  >
                    {removingProductId === f.product.id ? "Rimozione..." : "Rimuovi"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
