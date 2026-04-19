"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { EasterProduct } from "@/components/seasonal/EasterProductsCarousel";
import { Playfair_Display } from "next/font/google";

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
  seasonalActive = true,
}: {
  products: EasterProduct[];
  rotateMs?: number;
  seasonalActive?: boolean;
}) {
  const items = useMemo(() => {
    const list = Array.isArray(products) ? products : [];
    return list.filter((p) => p?.slug && p?.name).slice(0, 10);
  }, [products]);

  const [idx, setIdx] = useState(0);
  const active = items[idx] ?? null;

  useEffect(() => {
    if (!seasonalActive) return;
    if (items.length <= 1) return;
    const t = window.setInterval(() => setIdx((cur) => (cur + 1) % items.length), rotateMs);
    return () => window.clearInterval(t);
  }, [items.length, rotateMs, seasonalActive]);

  useEffect(() => {
    if (!items.length) return;
    if (idx >= items.length) setIdx(0);
  }, [items.length, idx]);

  const copy = seasonalActive
    ? {
        badge: "Speciale Pasqua",
        badgePill: "Promo",
        title: "Golose delizie per una Pasqua da favola",
        description:
          "Uova, ovetti, decorazioni e idee regalo: scopri la selezione pasquale e approfitta delle offerte.",
        primaryHref: "/occasione/pasqua",
        primaryLabel: "Scopri Pasqua",
        secondaryHref: "/occasione/pasqua",
        secondaryLabel: "Vedi tutti i prodotti",
        featuredEyebrow: "In evidenza",
        featuredTitle: "Prodotti pasquali selezionati",
        emptyText: "Nessun prodotto pasquale disponibile al momento.",
        backgroundClass:
          "absolute inset-0 bg-[url('/easter/hero-bg.jpg')] bg-cover bg-left",
        overlay: (
          <>
            <div className="absolute inset-0 bg-gradient-to-r from-[#D4AF37] via-[#F6E27A] via-[#FFF4C8] to-white" />
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-white/30 to-transparent" />
            <div className="absolute inset-y-0 right-0 w-[84%] bg-gradient-to-l from-white via-white/95 via-white/55 to-transparent" />
            <div className="absolute inset-y-0 right-0 w-[34%] bg-white" />
          </>
        ),
      }
    : {
        badge: "Selezione del momento",
        badgePill: "Novità",
        title: "Golose delizie selezionate per ogni occasione",
        description:
          "Scopri prodotti, decorazioni e idee regalo scelti per te. Esplora il catalogo e trova subito ciò che cerchi.",
        primaryHref: "/catalogo",
        primaryLabel: "Vai al catalogo",
        secondaryHref: "/contatti",
        secondaryLabel: "Contattaci",
        featuredEyebrow: "In evidenza",
        featuredTitle: "Prodotti selezionati",
        emptyText: "Scopri il catalogo completo per vedere i prodotti disponibili.",
        backgroundClass:
          "absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.16),transparent_30%),linear-gradient(135deg,#fffdf8_0%,#fff7e8_45%,#ffffff_100%)]",
        overlay: (
          <>
            <div className="absolute inset-0 bg-gradient-to-r from-[#F5E8BE] via-[#FFF7E4] to-white" />
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-white/35 to-transparent" />
            <div className="absolute inset-y-0 right-0 w-[84%] bg-gradient-to-l from-white via-white/95 via-white/60 to-transparent" />
            <div className="absolute inset-y-0 right-0 w-[34%] bg-white" />
          </>
        ),
      };

  return (
    <section className="mt-2">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-background">
        <div aria-hidden="true" className={copy.backgroundClass} />
        <div aria-hidden="true" className="absolute inset-0">
          {copy.overlay}
        </div>

        <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold text-text">
              {copy.badge}{" "}
              <span className="rounded-full bg-amber-500/90 px-2 py-0.5 text-[11px] text-white">
                {copy.badgePill}
              </span>
            </div>

            <div className="mt-6 flex flex-col items-center text-center">
              <Image
                src="/brand/tavoleefavole-logo.svg"
                alt="Tavole & Favole"
                width={420}
                height={140}
                className="h-24 w-auto sm:h-28"
                priority
              />

              <h1
                className={[
                  playfair.className,
                  "mt-6 max-w-[22ch]",
                  "text-4xl sm:text-5xl lg:text-6xl",
                  "font-semibold italic tracking-tight",
                  "text-[#3B2618]",
                  "drop-shadow-[0_1px_0_rgba(255,255,255,0.35)]",
                ].join(" ")}
              >
                {copy.title}
              </h1>

              <p className="mt-4 max-w-xl text-sm text-[#4A2F1F]/80 sm:text-base">
                {copy.description}
              </p>

              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold text-text">
                  Pagamenti sicuri
                </span>
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold text-text">
                  Prodotti di Qualità
                </span>
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold text-text">
                  Assistenza reale
                </span>
              </div>

              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link
                  href={copy.primaryHref}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover"
                >
                  {copy.primaryLabel}
                </Link>

                <Link
                  href={copy.secondaryHref}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-white/90 px-5 text-sm font-extrabold text-text hover:bg-white"
                >
                  {copy.secondaryLabel}
                </Link>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="ml-auto max-w-[560px] rounded-[2rem] bg-white/90 p-4 shadow-[0_24px_80px_rgba(59,38,24,0.08)] backdrop-blur-sm sm:p-5 lg:p-6">
              <div className="pr-2">
                <div className="text-sm font-extrabold text-text/70 sm:text-base">
                  {copy.featuredEyebrow}
                </div>
                <div className="mt-1 text-xl font-extrabold leading-tight text-[#3B2618] sm:text-2xl">
                  {copy.featuredTitle}
                </div>
              </div>

              {seasonalActive && active ? (
                <div className="mt-4">
                  <Link
                    href={`/prodotto/${active.slug}`}
                    className="group block"
                    aria-label={active.name}
                  >
                    <div className="relative min-h-[260px] overflow-hidden rounded-[1.75rem] border border-[#F2E3BD] bg-gradient-to-br from-white via-[#FFF9EE] to-[#F7E7B9]/60 sm:min-h-[320px] lg:min-h-[360px]">
                      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#FFF7E3]/80 via-transparent to-white/30" />
                      <div aria-hidden="true" className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-[#E9C95C]/20 blur-2xl" />

                      {typeof active.compareAtPrice === "number" &&
                      typeof active.price === "number" &&
                      active.compareAtPrice > active.price ? (
                        <div className="absolute right-4 top-4 z-10 rounded-full bg-[#E0B848] px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5E3E0B] shadow-sm sm:text-xs">
                          Promo
                        </div>
                      ) : null}

                      {active.imageUrl ? (
                        <Image
                          src={active.imageUrl}
                          alt={active.name}
                          fill
                          sizes="(min-width: 1280px) 520px, (min-width: 1024px) 46vw, 100vw"
                          className="object-contain object-center p-4 transition-transform duration-500 group-hover:scale-[1.02] sm:p-6"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full min-h-[260px] items-center justify-center px-6 text-center text-sm font-semibold text-text/60 sm:min-h-[320px] lg:min-h-[360px]">
                          Immagine prodotto non disponibile
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="mt-5 text-center">
                    <Link
                      href={`/prodotto/${active.slug}`}
                      className="block text-base font-extrabold leading-snug text-[#3B2618] transition-colors hover:text-primary sm:text-xl"
                    >
                      <span className="line-clamp-2 sm:line-clamp-3">{active.name}</span>
                    </Link>

                    <div className="mt-3 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
                      {typeof active.price === "number" && Number.isFinite(active.price) ? (
                        <span className="text-2xl font-extrabold text-primary sm:text-[2rem]">
                          {formatEUR(active.price)}
                        </span>
                      ) : (
                        <span className="text-xl font-extrabold text-text">Prezzo n.d.</span>
                      )}

                      {typeof active.compareAtPrice === "number" &&
                      typeof active.price === "number" &&
                      active.compareAtPrice > active.price ? (
                        <span className="text-base text-text/45 line-through sm:text-lg">
                          {formatEUR(active.compareAtPrice)}
                        </span>
                      ) : null}
                    </div>

                    {items.length > 1 ? (
                      <div className="mt-5 flex items-center justify-center gap-2">
                        {items.slice(0, Math.min(6, items.length)).map((_, i) => (
                          <span
                            key={i}
                            className={[
                              "rounded-full transition-all duration-300",
                              i === idx ? "h-2.5 w-5 bg-primary" : "h-2.5 w-2.5 bg-black/15",
                            ].join(" ")}
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-[1.75rem] border border-border bg-white p-5 text-sm text-text/70">
                  {copy.emptyText}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}