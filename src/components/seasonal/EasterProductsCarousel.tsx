"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

export type EasterProduct = {
  slug: string;
  name: string;
  imageUrl?: string | null;
  price?: number | null;
  compareAtPrice?: number | null;
};

function formatEUR(n: number) {
  try {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
  } catch {
    return `€ ${n.toFixed(2)}`;
  }
}

export default function EasterProductsCarousel({
  title = "Speciale Pasqua",
  subtitle = "Prodotti pasquali selezionati",
  rightHref = "/catalogo?occasione=pasqua",
  rightLabel = "Vedi tutti",
  items,
  autoScroll = true,
}: {
  title?: string;
  subtitle?: string;
  rightHref?: string;
  rightLabel?: string;
  items: EasterProduct[];
  autoScroll?: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // pausa quando l’utente interagisce
  const [paused, setPaused] = useState(false);
  const resumeTimerRef = useRef<number | null>(null);

  const canScroll = useMemo(() => (items?.length ?? 0) > 0, [items?.length]);

  function clearResumeTimer() {
    if (resumeTimerRef.current) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }

  function pauseTemporarily(ms = 2500) {
    setPaused(true);
    clearResumeTimer();
    resumeTimerRef.current = window.setTimeout(() => setPaused(false), ms);
  }

  function scrollByCard(dir: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(280, Math.floor(el.clientWidth * 0.75));
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
    pauseTemporarily(2500);
  }

  // Autoscroll “deghi style”
  useEffect(() => {
    if (!autoScroll) return;
    if (!canScroll) return;

    const el = scrollerRef.current;
    if (!el) return;

    let raf = 0;
    let last = performance.now();

    const speedPxPerSec = 28; // velocità (più alto = più veloce)

    const tick = (now: number) => {
      raf = window.requestAnimationFrame(tick);
      const dt = now - last;
      last = now;

      if (paused) return;

      // se non c’è abbastanza overflow, non fare nulla
      if (el.scrollWidth <= el.clientWidth + 2) return;

      const delta = (speedPxPerSec * dt) / 1000;
      el.scrollLeft += delta;

      // loop morbido: quando arrivi quasi in fondo, riparti
      const nearEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      if (nearEnd) {
        // salto “istantaneo” ma non evidente perché siamo su texture/slider
        el.scrollLeft = 0;
      }
    };

    raf = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [autoScroll, canScroll, paused]);

  // Pausa su hover / touch / wheel / scroll manuale
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onWheel = () => pauseTemporarily(2500);
    const onTouch = () => pauseTemporarily(3000);
    const onScroll = () => pauseTemporarily(2000);

    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("touchstart", onTouch, { passive: true });
    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouch);
      el.removeEventListener("scroll", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!items?.length) return null;

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-text/70">{subtitle}</p> : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollByCard(-1)}
            disabled={!canScroll}
            className="hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background hover:bg-surface-2 disabled:opacity-50"
            aria-label="Scorri a sinistra"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => scrollByCard(1)}
            disabled={!canScroll}
            className="hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background hover:bg-surface-2 disabled:opacity-50"
            aria-label="Scorri a destra"
          >
            →
          </button>

          <Link href={rightHref} className="text-sm font-semibold text-link hover:text-link-hover">
            {rightLabel}
          </Link>
        </div>
      </div>

      <div
        className="relative mt-6 -mx-4 px-4"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => {
          setPaused(false);
          clearResumeTimer();
        }}
      >
        <div
          ref={scrollerRef}
          className="no-scrollbar flex gap-4 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory"
          aria-label="Prodotti Pasqua"
        >
          {items.map((p) => {
            const hasSale =
              typeof p.compareAtPrice === "number" &&
              typeof p.price === "number" &&
              p.compareAtPrice > p.price;

            return (
              <Link
                key={p.slug}
                href={`/prodotto/${p.slug}`}
                className="snap-start shrink-0 w-[240px] rounded-2xl border border-border bg-background p-4 hover:shadow-sm transition"
                onPointerDown={() => pauseTemporarily(3000)}
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-surface-2/60">
                  {p.imageUrl ? (
                    <Image
                      src={p.imageUrl}
                      alt={p.name}
                      fill
                      sizes="240px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : null}

                  {hasSale ? (
                    <span className="absolute left-2 top-2 rounded-full bg-accent px-3 py-1 text-[11px] font-extrabold text-accent-contrast">
                      Offerta
                    </span>
                  ) : (
                    <span className="absolute left-2 top-2 rounded-full bg-emerald-700 px-3 py-1 text-[11px] font-extrabold text-white">
                      Pasqua
                    </span>
                  )}
                </div>

                <div className="mt-3 text-sm font-extrabold line-clamp-2">{p.name}</div>

                <div className="mt-2 flex items-baseline gap-2">
                  {typeof p.price === "number" && Number.isFinite(p.price) ? (
                    <span className="text-sm font-extrabold">{formatEUR(p.price)}</span>
                  ) : (
                    <span className="text-sm font-extrabold">Prezzo n.d.</span>
                  )}

                  {hasSale ? (
                    <span className="text-xs line-through text-text/50">
                      {formatEUR(p.compareAtPrice as number)}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 inline-flex h-9 items-center justify-center rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover">
                  Scopri →
                </div>
              </Link>
            );
          })}
        </div>

        {/* fade laterali */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-background via-background/70 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background via-background/70 to-transparent" />
      </div>
    </section>
  );
}