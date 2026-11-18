"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type HeroProduct = {
  id: string;
  slug: string;
  name: string;
  image?: string;
  price?: number | null;
  compareAtPrice?: number | null;
};

const IS_CHRISTMAS =
  String(process.env.NEXT_PUBLIC_SITE_THEME ?? "").trim().toLowerCase() === "christmas";

function formatEUR(n?: number | null) {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  try {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(n);
  } catch {
    return `€ ${n.toFixed(2)}`;
  }
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M12.5 4.5L7 10l5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M7.5 4.5L13 10l-5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SparkleGemIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-3.5 w-3.5 text-primary">
      <path
        d="M6 3.5h8l3 4.5-7 8.5-7-8.5 3-4.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GiftIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <rect x="3" y="8" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 8h15M10 8v9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 8c-1.5 0-3.5-.8-3.5-2.3C6.5 4.5 7.5 3.8 8.5 4.2 9.4 4.5 10 6 10 8Zm0 0c1.5 0 3.5-.8 3.5-2.3 0-1.2-1-1.9-2-1.5-.9.3-1.5 1.8-1.5 3.8Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function StarIcon({ className = "h-4 w-4 text-primary" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="m10 2.8 2.1 4.4 4.8.7-3.5 3.4.8 4.8-4.2-2.2-4.2 2.2.8-4.8-3.5-3.4 4.8-.7L10 2.8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AwardIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4 text-primary">
      <circle cx="10" cy="7.5" r="4.2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M7.5 11.2 6.5 17l3.5-1.8L13.5 17l-1-5.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeadsetIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4 text-primary">
      <path
        d="M4 11V9.5a6 6 0 1 1 12 0V11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect x="2.8" y="10.2" width="2.8" height="4.8" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="14.4" y="10.2" width="2.8" height="4.8" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export default function HomeDualHero({
  selectedProducts,
  latestProducts,
}: {
  selectedProducts: HeroProduct[];
  latestProducts: HeroProduct[];
}) {
  const leftItems = useMemo(
    () => (Array.isArray(selectedProducts) ? selectedProducts.slice(0, 6) : []),
    [selectedProducts]
  );

  const rightItems = useMemo(
    () => (Array.isArray(latestProducts) ? latestProducts.slice(0, 3) : []),
    [latestProducts]
  );

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (activeIndex >= leftItems.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, leftItems.length]);

  useEffect(() => {
    if (leftItems.length <= 1) return;

    const timer = window.setInterval(() => {
      setActiveIndex((cur) => (cur + 1) % leftItems.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [leftItems.length]);

  const activeProduct =
    leftItems.length > 0
      ? leftItems[((activeIndex % leftItems.length) + leftItems.length) % leftItems.length]
      : null;

  function goPrev() {
    if (!leftItems.length) return;
    setActiveIndex((cur) => (cur - 1 + leftItems.length) % leftItems.length);
  }

  function goNext() {
    if (!leftItems.length) return;
    setActiveIndex((cur) => (cur + 1) % leftItems.length);
  }

  return (
    <section className="mt-3">
      <div className="grid gap-6 lg:grid-cols-12 lg:items-stretch">
        {/* COLONNA SINISTRA: Hero principale + Carosello in evidenza */}
        <div className="lg:col-span-8 flex">
          <div className="relative flex h-full w-full overflow-hidden rounded-[2rem] border border-border bg-background shadow-[0_22px_70px_rgba(0,0,0,0.05)]">
            <div
              aria-hidden="true"
              className={
                IS_CHRISTMAS
                  ? "absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.22),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(178,24,43,0.08),transparent_42%),linear-gradient(135deg,#fffdf8_0%,#fdf6ec_55%,#ffffff_100%)]"
                  : "absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.14),transparent_32%),linear-gradient(135deg,#fffdf9_0%,#fcf8f3_55%,#ffffff_100%)]"
              }
            />

            <div className="relative grid w-full gap-6 p-6 sm:p-8 lg:grid-cols-12 lg:items-center lg:gap-8 lg:p-9">
              {/* Testi e CTA */}
              <div className="flex flex-col justify-between lg:col-span-6">
                <div>
                  <p className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-white/90 px-3 py-1 text-xs font-extrabold text-primary shadow-sm">
                    {IS_CHRISTMAS ? (
                      <>
                        <span aria-hidden="true">🎄</span>
                        <span>Speciale Natale • Selezione per le feste</span>
                      </>
                    ) : (
                      <>
                        <SparkleGemIcon />
                        <span>Selezione premium per ogni occasione</span>
                      </>
                    )}
                  </p>

                  <h1 className="mt-4 text-3xl font-extrabold leading-[1.04] tracking-tight text-text sm:text-4xl xl:text-[2.75rem]">
                    {IS_CHRISTMAS ? (
                      <>
                        La magia del Natale in{" "}
                        <span className="text-primary">dolcezze da condividere.</span>
                      </>
                    ) : (
                      <>
                        Piccole dolcezze per{" "}
                        <span className="text-primary">grandi momenti da ricordare.</span>
                      </>
                    )}
                  </h1>

                  <p className="mt-4 text-sm leading-6 text-text/75">
                    {IS_CHRISTMAS
                      ? "Scopri la nostra selezione natalizia di specialità artigianali, idee regalo, cioccolato e dolcezze delle feste, scelte con cura per rendere indimenticabile la tavola di Natale."
                      : "Da Tavole & Favole trovi una selezione curata di dolcezze, specialità di alta qualità, idee regalo e articoli per feste, scelti per rendere speciale ogni occasione: dalle ricorrenze stagionali ai compleanni, dalle cerimonie ai momenti più semplici da condividere."}
                  </p>

                  <div className="mt-6">
                    <Link
                      href={IS_CHRISTMAS ? "/occasione/natale" : "/catalogo"}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-sm font-extrabold text-primary-contrast shadow-sm transition hover:bg-primary-hover"
                    >
                      <GiftIcon className="h-4 w-4" />
                      <span>
                        {IS_CHRISTMAS
                          ? "Scopri lo Speciale Natale"
                          : "Scopri le specialità del momento"}
                      </span>
                      <ChevronRightIcon className="h-4 w-4" />
                    </Link>
                  </div>
                </div>

                {/* 3 mini-card punti di forza */}
                <div className="mt-6 grid grid-cols-3 gap-2.5">
                  <div className="flex items-center gap-2 rounded-2xl border border-border bg-white/90 px-3 py-2.5 shadow-sm">
                    <span className="shrink-0">
                      <StarIcon />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-extrabold text-text">Specialità</div>
                      <div className="truncate text-[11px] text-text/60">Scelte con cura</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-2xl border border-border bg-white/90 px-3 py-2.5 shadow-sm">
                    <span className="shrink-0">
                      <AwardIcon />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-extrabold text-text">Marchi</div>
                      <div className="truncate text-[11px] text-text/60">Alta qualità</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-2xl border border-border bg-white/90 px-3 py-2.5 shadow-sm">
                    <span className="shrink-0">
                      <HeadsetIcon />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-extrabold text-text">Assistenza</div>
                      <div className="truncate text-[11px] text-text/60">Sempre attiva</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card prodotto in evidenza */}
              <div className="flex lg:col-span-6">
                {activeProduct ? (
                  <div className="relative flex w-full flex-col justify-between rounded-[1.75rem] border border-border bg-white p-5 shadow-[0_16px_45px_rgba(0,0,0,0.06)]">
                    <div className="flex justify-end">
                      <span className="inline-flex items-center rounded-full border border-border bg-surface-2/70 px-3 py-1 text-[11px] font-extrabold text-primary">
                        {IS_CHRISTMAS ? "Idee Natale" : "In evidenza"}
                      </span>
                    </div>

                    <Link
                      href={`/prodotto/${activeProduct.slug}`}
                      className="group relative my-3 block h-48 w-full overflow-hidden rounded-2xl bg-white sm:h-52"
                    >
                      {activeProduct.image ? (
                        <Image
                          src={activeProduct.image}
                          alt={activeProduct.name}
                          fill
                          className="object-contain p-3 transition-transform duration-300 group-hover:scale-[1.04]"
                          sizes="(max-width: 1024px) 100vw, 420px"
                          priority={activeIndex === 0}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-6 text-center text-sm font-semibold text-text/60">
                          Immagine prodotto non disponibile
                        </div>
                      )}
                    </Link>

                    <div>
                      <Link
                        href={`/prodotto/${activeProduct.slug}`}
                        className="line-clamp-2 text-lg font-extrabold leading-snug text-text transition hover:text-primary sm:text-xl"
                      >
                        {activeProduct.name}
                      </Link>

                      <div className="mt-2 flex flex-wrap items-baseline gap-2.5">
                        {formatEUR(activeProduct.price) ? (
                          <span className="text-xl font-extrabold text-primary">
                            {formatEUR(activeProduct.price)}
                          </span>
                        ) : (
                          <span className="text-sm font-semibold text-text/60">Prezzo n.d.</span>
                        )}

                        {typeof activeProduct.compareAtPrice === "number" &&
                        typeof activeProduct.price === "number" &&
                        activeProduct.compareAtPrice > activeProduct.price ? (
                          <span className="text-sm text-text/45 line-through">
                            {formatEUR(activeProduct.compareAtPrice)}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={goPrev}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-text transition hover:bg-surface-2"
                            aria-label="Prodotto precedente"
                          >
                            <ChevronLeftIcon />
                          </button>

                          <button
                            type="button"
                            onClick={goNext}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-text transition hover:bg-surface-2"
                            aria-label="Prodotto successivo"
                          >
                            <ChevronRightIcon />
                          </button>
                        </div>

                        <Link
                          href={`/prodotto/${activeProduct.slug}`}
                          className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-contrast transition hover:bg-primary-hover"
                        >
                          Vedi prodotto
                        </Link>
                      </div>

                      {leftItems.length > 1 ? (
                        <div className="mt-4 flex items-center gap-1.5">
                          {leftItems.map((_, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setActiveIndex(i)}
                              aria-label={`Vai al prodotto ${i + 1}`}
                              className={[
                                "rounded-full transition-all",
                                i === activeIndex
                                  ? "h-2 w-6 bg-primary"
                                  : "h-2 w-2 bg-black/15 hover:bg-black/25",
                              ].join(" ")}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-2xl border border-border bg-white p-6 text-sm text-text/70">
                    Nessun prodotto selezionato disponibile al momento.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* COLONNA DESTRA: Specialità appena arrivate */}
        <div className="lg:col-span-4 flex">
          <div className="relative flex h-full w-full overflow-hidden rounded-[2rem] border border-border bg-background shadow-[0_22px_70px_rgba(0,0,0,0.05)]">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[linear-gradient(180deg,#ffffff_0%,#fcf8f5_100%)]"
            />

            <div className="relative flex w-full flex-col p-6 sm:p-7">
              <p className="text-xs font-extrabold text-primary">
                {IS_CHRISTMAS ? "Novità delle feste" : "Novità selezionate"}
              </p>

              <h2 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight text-text sm:text-[1.75rem]">
                Specialità appena arrivate
              </h2>

              <p className="mt-2 text-sm leading-6 text-text/70">
                Scopri le ultime dolcezze, idee regalo e specialità stagionali aggiunte al catalogo.
              </p>

              {/* Pillole */}
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-xs font-extrabold text-text shadow-sm">
                  <StarIcon className="h-3.5 w-3.5 text-primary" />
                  <span>Stagionali</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-xs font-extrabold text-text shadow-sm">
                  <GiftIcon className="h-3.5 w-3.5 text-primary" />
                  <span>Idee regalo</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-xs font-extrabold text-text shadow-sm">
                  <SparkleGemIcon />
                  <span>Alta qualità</span>
                </span>
              </div>

              {/* Lista 3 novità compatte */}
              <div className="mt-5 flex flex-1 flex-col justify-between gap-3">
                {rightItems.length > 0 ? (
                  rightItems.map((p) => (
                    <Link
                      key={p.id}
                      href={`/prodotto/${p.slug}`}
                      className="group flex items-center justify-between gap-3 rounded-2xl border border-border bg-white p-3 shadow-sm transition hover:border-primary/30 hover:shadow-md"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-2/40">
                          {p.image ? (
                            <Image
                              src={p.image}
                              alt={p.name}
                              fill
                              className="object-contain p-1.5 transition-transform duration-200 group-hover:scale-105"
                              sizes="64px"
                            />
                          ) : null}
                        </div>

                        <div className="min-w-0">
                          <div className="line-clamp-2 text-sm font-extrabold leading-snug text-text transition group-hover:text-primary">
                            {p.name}
                          </div>
                          <div className="mt-1 text-sm font-extrabold text-primary">
                            {formatEUR(p.price) ?? "Scopri di più"}
                          </div>
                        </div>
                      </div>

                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-text/60 transition group-hover:border-primary/30 group-hover:text-primary">
                        <ChevronRightIcon className="h-3.5 w-3.5" />
                      </span>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-2xl border border-border bg-white p-4 text-sm text-text/70">
                    Nessuna novità disponibile al momento.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}