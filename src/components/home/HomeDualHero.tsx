"use client";

import Link from "next/link";
import Image from "next/image";

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

export default function HomeDualHero({
  selectedProducts,
  latestProducts,
}: {
  selectedProducts: HeroProduct[];
  latestProducts: HeroProduct[];
}) {
  const leftItems = Array.isArray(selectedProducts) ? selectedProducts.slice(0, 6) : [];
  const rightItems = Array.isArray(latestProducts) ? latestProducts.slice(0, 3) : [];

  return (
    <section className="mt-2">
      <div className="grid gap-6 lg:grid-cols-12">
        {/* SINISTRA */}
        <div className="lg:col-span-8">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-background">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.18),transparent_28%),linear-gradient(135deg,#fffdf8_0%,#fff6e8_48%,#ffffff_100%)]"
            />
            <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-6">
                <p className="inline-flex items-center rounded-full border border-border bg-white/85 px-3 py-1 text-xs font-extrabold text-text/70">
                  Selezione speciale
                </p>

                <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-text sm:text-5xl lg:text-6xl">
                  Prodotti selezionati per te
                </h1>

                <p className="mt-4 max-w-xl text-sm leading-6 text-text/70 sm:text-base">
                  Una selezione curata di specialità, idee regalo e articoli scelti tra i prodotti
                  più interessanti del catalogo.
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold text-text">
                    Pagamenti sicuri
                  </span>
                  <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold text-text">
                    Prodotti di qualità
                  </span>
                  <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold text-text">
                    Assistenza reale
                  </span>
                </div>

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Link
                    href="/catalogo"
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover"
                  >
                    Scopri la selezione
                  </Link>

                  <Link
                    href="/contatti"
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-white px-5 text-sm font-extrabold text-text hover:bg-surface-2"
                  >
                    Contattaci
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-6">
                {leftItems.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {leftItems.map((p) => (
                      <Link
                        key={p.id}
                        href={`/prodotto/${p.slug}`}
                        className="group overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition hover:shadow-md"
                      >
                        <div className="relative aspect-[4/3] bg-surface">
                          {p.image ? (
                            <Image
                              src={p.image}
                              alt={p.name}
                              fill
                              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                              sizes="(max-width: 1024px) 100vw, 300px"
                            />
                          ) : null}
                        </div>

                        <div className="p-4">
                          <div className="line-clamp-2 text-sm font-extrabold text-text">
                            {p.name}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {formatEUR(p.price) ? (
                              <span className="text-sm font-extrabold text-primary">
                                {formatEUR(p.price)}
                              </span>
                            ) : (
                              <span className="text-sm font-semibold text-text/60">
                                Prezzo n.d.
                              </span>
                            )}

                            {typeof p.compareAtPrice === "number" &&
                            typeof p.price === "number" &&
                            p.compareAtPrice > p.price ? (
                              <span className="text-xs text-text/45 line-through">
                                {formatEUR(p.compareAtPrice)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </Link>
                    ))}
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
        <div className="lg:col-span-4">
          <div className="h-full overflow-hidden rounded-3xl border border-border bg-background">
            <div
              aria-hidden="true"
              className="absolute"
            />
            <div className="p-6 sm:p-8">
              <p className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-xs font-extrabold text-text/70">
                Nuovi arrivi
              </p>

              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-text sm:text-4xl">
                Le novità del momento
              </h2>

              <p className="mt-3 text-sm leading-6 text-text/70 sm:text-base">
                Scopri gli ultimi prodotti inseriti, le nuove referenze e le novità da non perdere.
              </p>

              <div className="mt-6 space-y-3">
                {rightItems.length > 0 ? (
                  rightItems.map((p) => (
                    <Link
                      key={p.id}
                      href={`/prodotto/${p.slug}`}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3 transition hover:bg-surface-2"
                    >
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-surface">
                        {p.image ? (
                          <Image
                            src={p.image}
                            alt={p.name}
                            fill
                            className="object-cover"
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
                  ))
                ) : (
                  <div className="rounded-2xl border border-border bg-white p-4 text-sm text-text/70">
                    Nessuna novità disponibile al momento.
                  </div>
                )}
              </div>

              <div className="mt-6">
                <Link
                  href="/catalogo"
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover"
                >
                  Vedi le novità
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}