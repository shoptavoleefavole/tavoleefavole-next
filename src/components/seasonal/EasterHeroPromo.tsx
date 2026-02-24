"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { EasterProduct } from "@/components/seasonal/EasterProductsCarousel";
import { Playfair_Display } from "next/font/google";

// Font “elegante” simile al look dell’immagine 2
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  style: ["normal", "italic"],
});

function formatEUR(n: number) {
  try {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
  } catch {
    return `€ ${n.toFixed(2)}`;
  }
}

export default function EasterHeroPromo({
  products,
  rotateMs = 3500,
}: {
  products: EasterProduct[];
  rotateMs?: number;
}) {
  const items = useMemo(() => {
    const list = Array.isArray(products) ? products : [];
    return list.filter((p) => p?.slug && p?.name).slice(0, 10);
  }, [products]);

  const [idx, setIdx] = useState(0);
  const active = items[idx] ?? null;

  useEffect(() => {
    if (items.length <= 1) return;
    const t = window.setInterval(() => setIdx((cur) => (cur + 1) % items.length), rotateMs);
    return () => window.clearInterval(t);
  }, [items.length, rotateMs]);

  useEffect(() => {
    if (!items.length) return;
    if (idx >= items.length) setIdx(0);
  }, [items.length, idx]);

  return (
    <section className="mt-2">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-background">
        {/* Background immagine */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[url('/easter/hero-bg.jpg')] bg-cover bg-left"
        />

        {/* Overlay oro -> bianco (già approvato) */}
        <div aria-hidden="true" className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-[#D4AF37] via-[#F6E27A] via-[#FFF4C8] to-white" />
          <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-white/30 to-transparent" />
          <div className="absolute inset-y-0 right-0 w-[84%] bg-gradient-to-l from-white via-white/95 via-white/55 to-transparent" />
          <div className="absolute inset-y-0 right-0 w-[34%] bg-white" />
        </div>

        <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-12 lg:items-center">
          {/* LEFT */}
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold text-text">
              Speciale Pasqua{" "}
              <span className="rounded-full bg-amber-500/90 px-2 py-0.5 text-[11px] text-white">
                Promo
              </span>
            </div>

            {/* ✅ Logo più centrato */}
            <div className="mt-6 flex flex-col items-center text-center">
              <Image
                src="/brand/tavoleefavole-logo.svg"
                alt="Tavole & Favole"
                width={420}
                height={140}
                className="h-24 w-auto sm:h-28"
                priority
              />

              {/* ✅ Titolo: font + colore come immagine 2 */}
              <h1
                className={[
                  playfair.className,
                  "mt-6 max-w-[22ch]",
                  "text-4xl sm:text-5xl lg:text-6xl",
                  "font-semibold italic tracking-tight",
                  "text-[#3B2618]", // marrone “cioccolato”
                  "drop-shadow-[0_1px_0_rgba(255,255,255,0.35)]",
                ].join(" ")}
              >
                Golose delizie per una Pasqua da favola
              </h1>

              {/* descrizione più scura (non bianca) */}
              <p className="mt-4 max-w-xl text-sm text-[#4A2F1F]/80 sm:text-base">
                Uova, ovetti, decorazioni e idee regalo: scopri la selezione pasquale e approfitta delle offerte.
              </p>

              {/* Punti di forza */}
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold text-text">
                  Pagamenti sicuri
                </span>
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold text-text">
                  Resi semplici
                </span>
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold text-text">
                  Assistenza reale
                </span>
              </div>

              {/* CTA */}
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link
                  href="/occasione/pasqua"
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover"
                >
                  Scopri Pasqua
                </Link>

                <Link
                  href="/catalogo?occasione=pasqua"
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-white/90 px-5 text-sm font-extrabold text-text hover:bg-white"
                >
                  Vedi tutti i prodotti
                </Link>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-6">
            <div className="rounded-3xl bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-extrabold text-text/70">In evidenza</div>
                  <div className="text-sm font-extrabold text-text">Prodotti pasquali selezionati</div>
                </div>

                {items.length > 1 ? (
                  <div className="flex items-center gap-1">
                    {items.slice(0, Math.min(6, items.length)).map((_, i) => (
                      <span
                        key={i}
                        className={["h-2 w-2 rounded-full", i === idx ? "bg-primary" : "bg-black/15"].join(" ")}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                ) : null}
              </div>

              {active ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:items-center">
                  <Link
                    href={`/prodotto/${active.slug}`}
                    className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface-2/60"
                    aria-label={active.name}
                  >
                    {active.imageUrl ? (
                      <Image
                        src={active.imageUrl}
                        alt={active.name}
                        fill
                        sizes="(min-width: 1024px) 420px, 100vw"
                        className="object-cover"
                        unoptimized
                      />
                    ) : null}
                  </Link>

                  <div>
                    <div className="text-sm font-extrabold line-clamp-3 text-text">{active.name}</div>

                    <div className="mt-2 flex items-baseline gap-2">
                      {typeof active.price === "number" && Number.isFinite(active.price) ? (
                        <span className="text-lg font-extrabold text-text">{formatEUR(active.price)}</span>
                      ) : (
                        <span className="text-lg font-extrabold text-text">Prezzo n.d.</span>
                      )}

                      {typeof active.compareAtPrice === "number" &&
                      typeof active.price === "number" &&
                      active.compareAtPrice > active.price ? (
                        <span className="text-sm line-through text-text/50">{formatEUR(active.compareAtPrice)}</span>
                      ) : null}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/prodotto/${active.slug}`}
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover"
                      >
                        Scopri →
                      </Link>

                      <Link
                        href="/occasione/pasqua"
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-extrabold hover:bg-surface-2"
                      >
                        Vetrina Pasqua
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-border bg-white p-4 text-sm text-text/70">
                  Nessun prodotto pasquale disponibile al momento.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}