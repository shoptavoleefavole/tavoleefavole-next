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
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-5 w-5">
      <path
        d="M12.5 4.5L7 10l5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-5 w-5">
      <path
        d="M7.5 4.5L13 10l-5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
  }, [leftItems.length, activeIndex]);

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

  const featuredLatest = rightItems[0] ?? null;
  const secondaryLatest = rightItems.slice(1);

  return (
    <section className="mt-2">
      <div className="grid gap-6 lg:grid-cols-12 lg:items-stretch">
        {/* SINISTRA */}
        <div className="lg:col-span-8 flex">
          <div className="relative flex h-full w-full min-h-[620px] overflow-hidden rounded-[2rem] border border-border bg-background shadow-[0_18px_60px_rgba(0,0,0,0.04)]">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.18),transparent_28%),linear-gradient(135deg,#fffdf8_0%,#fff6e8_48%,#ffffff_100%)]"
            />
            <div
              aria-hidden="true"
              className="absolute right-[-80px] top-[-80px] h-64 w-64 rounded-full bg-white/40 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="absolute bottom-[-100px] left-[-60px] h-72 w-72 rounded-full bg-[#EBCB76]/12 blur-3xl"
            />

            <div className="relative grid w-full gap-8 p-6 sm:p-10 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-5">
                <p className="inline-flex items-center rounded-full border border-border bg-white/85 px-3 py-1 text-xs font-extrabold text-text/70 shadow-sm">
                  Selezione speciale
                </p>

                <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-text sm:text-5xl lg:text-6xl">
                  Prodotti selezionati per te
                </h1>

                <p className="mt-4 max-w-xl text-sm leading-6 text-text/70 sm:text-base">
                  Una selezione curata di specialità, idee regalo e articoli scelti tra i prodotti
                  più interessanti del catalogo.
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold text-text shadow-sm">
                    Pagamenti sicuri
                  </span>
                  <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold text-text shadow-sm">
                    Prodotti di qualità
                  </span>
                  <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold text-text shadow-sm">
                    Assistenza reale
                  </span>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    href="/catalogo"
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-contrast shadow-sm transition hover:bg-primary-hover"
                  >
                    Scopri la selezione
                  </Link>

                  <Link
                    href="/contatti"
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-white px-5 text-sm font-extrabold text-text transition hover:bg-surface-2"
                  >
                    Contattaci
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-7">
                {activeProduct ? (
                  <div className="relative flex h-full min-h-[500px] flex-col overflow-hidden rounded-[2rem] border border-border bg-white shadow-[0_18px_50px_rgba(0,0,0,0.06)]">
                    <Link
                      href={`/prodotto/${activeProduct.slug}`}
                      className="group relative block flex-1 overflow-hidden bg-[#F8F5EE]"
                    >
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.12),transparent_32%)]" />
                      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/35 to-transparent" />

                      {activeProduct.image ? (
                        <Image
                          src={activeProduct.image}
                          alt={activeProduct.name}
                          fill
                          className="object-contain p-8 transition-transform duration-300 group-hover:scale-[1.03] sm:p-10"
                          sizes="(max-width: 1024px) 100vw, 640px"
                          priority={activeIndex === 0}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-6 text-center text-sm font-semibold text-text/60">
                          Immagine prodotto non disponibile
                        </div>
                      )}
                    </Link>

                    <div className="border-t border-border bg-white px-5 py-5 sm:px-6">
                      <div className="line-clamp-2 text-xl font-extrabold text-text">
                        {activeProduct.name}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
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

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
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
                          className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-contrast transition hover:bg-primary-hover"
                        >
                          Vedi prodotto
                        </Link>
                      </div>

                      {leftItems.length > 1 ? (
                        <div className="mt-5 flex items-center gap-2">
                          {leftItems.map((_, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setActiveIndex(i)}
                              aria-label={`Vai al prodotto ${i + 1}`}
                              className={[
                                "rounded-full transition-all",
                                i === activeIndex
                                  ? "h-2.5 w-6 bg-primary"
                                  : "h-2.5 w-2.5 bg-black/15 hover:bg-black/25",
                              ].join(" ")}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border bg-white p-5 text-sm text-text/70">
                    Nessun prodotto selezionato disponibile al momento.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* DESTRA */}
        <div className="lg:col-span-4 flex">
          <div className="relative flex h-full w-full min-h-[620px] overflow-hidden rounded-[2rem] border border-border bg-background shadow-[0_18px_60px_rgba(0,0,0,0.04)]">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[linear-gradient(180deg,#ffffff_0%,#fcfaf5_100%)]"
            />
            <div
              aria-hidden="true"
              className="absolute right-[-60px] top-[-60px] h-44 w-44 rounded-full bg-[#EBCB76]/10 blur-3xl"
            />

            <div className="relative flex w-full flex-col p-6 sm:p-8">
              <p className="inline-flex w-fit items-center rounded-full border border-border bg-white px-3 py-1 text-xs font-extrabold text-text/70 shadow-sm">
                Nuovi arrivi
              </p>

              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-text sm:text-4xl">
                Le novità del momento
              </h2>

              <p className="mt-3 text-sm leading-6 text-text/70 sm:text-base">
                Scopri gli ultimi prodotti inseriti, le nuove referenze e le novità da non perdere.
              </p>

              <div className="mt-6 flex flex-1 flex-col gap-4">
                {featuredLatest ? (
                  <Link
                    href={`/prodotto/${featuredLatest.slug}`}
                    className="group overflow-hidden rounded-[1.75rem] border border-border bg-white shadow-sm transition hover:shadow-md"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-[#F8F5EE]">
                      {featuredLatest.image ? (
                        <Image
                          src={featuredLatest.image}
                          alt={featuredLatest.name}
                          fill
                          className="object-contain p-6 transition-transform duration-300 group-hover:scale-[1.03]"
                          sizes="(max-width: 1024px) 100vw, 420px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-6 text-center text-sm font-semibold text-text/60">
                          Immagine non disponibile
                        </div>
                      )}
                    </div>

                    <div className="border-t border-border p-4">
                      <div className="line-clamp-2 text-base font-extrabold text-text">
                        {featuredLatest.name}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-base font-extrabold text-primary">
                          {formatEUR(featuredLatest.price) ?? "Scopri di più"}
                        </span>

                        {typeof featuredLatest.compareAtPrice === "number" &&
                        typeof featuredLatest.price === "number" &&
                        featuredLatest.compareAtPrice > featuredLatest.price ? (
                          <span className="text-sm text-text/45 line-through">
                            {formatEUR(featuredLatest.compareAtPrice)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div className="rounded-2xl border border-border bg-white p-4 text-sm text-text/70">
                    Nessuna novità disponibile al momento.
                  </div>
                )}

                {secondaryLatest.length > 0 ? (
                  <div className="grid gap-3">
                    {secondaryLatest.map((p) => (
                      <Link
                        key={p.id}
                        href={`/prodotto/${p.slug}`}
                        className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3 transition hover:bg-surface-2"
                      >
                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#F8F5EE]">
                          {p.image ? (
                            <Image
                              src={p.image}
                              alt={p.name}
                              fill
                              className="object-contain p-2"
                              sizes="80px"
                            />
                          ) : null}
                        </div>

                        <div className="min-w-0">
                          <div className="line-clamp-2 text-sm font-extrabold text-text">
                            {p.name}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-primary">
                            {formatEUR(p.price) ?? "Scopri di più"}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : null}

                <div className="mt-auto pt-2">
                  <Link
                    href="/catalogo"
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-contrast transition hover:bg-primary-hover"
                  >
                    Vedi le novità
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}