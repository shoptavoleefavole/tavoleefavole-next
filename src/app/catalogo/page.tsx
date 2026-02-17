"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Favorite = {
  id: number | string;
  product: {
    id: number | string;
    name: string;
    slug: string;
    price: number;
  };
};

const API_ENDPOINTS = ["/api/account/favorite", "/api/account/favorites"] as const;

function safeMoney(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

function normalizeFavorites(json: any): Favorite[] {
  const raw =
    (json && Array.isArray(json.favorites) && json.favorites) ||
    (json && Array.isArray(json.data) && json.data) ||
    [];

  const out: Favorite[] = [];
  for (const item of raw) {
    const id = item?.id ?? item?.documentId ?? item?._id;
    const p = item?.product ?? item?.attributes?.product ?? item?.data?.product;

    const productId = p?.id ?? p?.documentId ?? p?._id;
    const name = p?.name ?? p?.Titolo ?? p?.title ?? "";
    const slug = p?.slug ?? "";
    const price = Number(p?.price ?? 0);

    if (id == null) continue;
    if (productId == null || !slug || !name) continue;

    out.push({
      id,
      product: {
        id: productId,
        name: String(name),
        slug: String(slug),
        price: Number.isFinite(price) ? price : 0,
      },
    });
  }

  return out;
}

function prettyError(res: Response, json: any): string {
  if (res.status === 401) return "Devi accedere per vedere i preferiti.";
  if (res.status === 403) return "Non hai i permessi per questa operazione.";
  const serverMsg = json?.error ? String(json.error) : "";
  if (serverMsg) return serverMsg;
  return `Errore (HTTP ${res.status})`;
}

async function fetchJsonTryEndpoints(
  buildUrl: (base: string) => string,
  init?: RequestInit
): Promise<{ res: Response; json: any; used: string } | null> {
  for (const base of API_ENDPOINTS) {
    const url = buildUrl(base);
    const res = await fetch(url, { cache: "no-store", credentials: "include", ...init });

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (res.status === 404) continue;

    return { res, json, used: base };
  }

  return null;
}

export default function FavoritesPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");

    try {
      const result = await fetchJsonTryEndpoints((base) => base, { method: "GET" });

      if (!result) {
        if (!aliveRef.current) return;
        setFavorites([]);
        setErr("Endpoint preferiti non trovato (né /favorite né /favorites).");
        setLoading(false);
        return;
      }

      const { res, json } = result;

      if (!res.ok || json?.ok === false) {
        if (!aliveRef.current) return;
        setFavorites([]);
        setErr(prettyError(res, json));
        setLoading(false);
        return;
      }

      const normalized = normalizeFavorites(json);
      if (!aliveRef.current) return;
      setFavorites(normalized);
      setLoading(false);
    } catch (e: any) {
      if (!aliveRef.current) return;
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
    async (productId: string | number) => {
      const key = String(productId);
      setRemovingId(key);
      setErr("");

      try {
        const result = await fetchJsonTryEndpoints(
          (base) => `${base}?productId=${encodeURIComponent(key)}`,
          { method: "DELETE" }
        );

        if (!result) {
          if (!aliveRef.current) return;
          setErr("Endpoint rimozione preferiti non trovato.");
          setRemovingId(null);
          return;
        }

        const { res, json } = result;

        if (!res.ok || json?.ok === false) {
          if (!aliveRef.current) return;
          setErr(prettyError(res, json));
          setRemovingId(null);
          return;
        }

        await load();
        if (!aliveRef.current) return;
        setRemovingId(null);
      } catch (e: any) {
        if (!aliveRef.current) return;
        setErr(e?.message || "Errore di rete");
        setRemovingId(null);
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
            <div key={String(f.id)} style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
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
                    disabled={removingId === String(f.product.id)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid #ddd",
                      cursor: removingId === String(f.product.id) ? "not-allowed" : "pointer",
                      fontWeight: 800,
                    }}
                  >
                    {removingId === String(f.product.id) ? "Rimozione..." : "Rimuovi"}
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
