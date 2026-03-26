"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

export type HomeCta = {
  label: string;
  href: string;
};

export type HomeImage = {
  src: string;
  alt?: string;
};

/**
 * Compat:
 * - vecchio formato: { title, body }
 * - nuovo formato: { label, value }
 */
export type Highlight =
  | { label: string; value?: string }
  | { title: string; body?: string };

export type Slide = {
  id: string;
  className?: string;
  badge?: string;
  title: string;
  subtitle?: string;
  primaryCta?: HomeCta;
  secondaryCta?: HomeCta;
  leftImage?: HomeImage;
  rightImage?: HomeImage;
  highlights?: Highlight[];
};

function Dot({ active }: { active: boolean }) {
  return (
    <span
      className={["h-2 w-2 rounded-full transition", active ? "bg-text" : "bg-text/25"].join(" ")}
      aria-hidden="true"
    />
  );
}

function Arrow({ dir, onClick }: { dir: "prev" | "next"; onClick: () => void }) {
  const isPrev = dir === "prev";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isPrev ? "Slide precedente" : "Slide successiva"}
      className={[
        "hidden md:inline-flex",
        "h-11 w-11 items-center justify-center rounded-full",
        "border border-border bg-background/90 backdrop-blur",
        "hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      ].join(" ")}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d={isPrev ? "M12.5 4.5L7.5 10l5 5.5" : "M7.5 4.5L12.5 10l-5 5.5"}
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function normalizeHighlight(h: Highlight): { label: string; value?: string } {
  if ("label" in h) return { label: h.label, value: h.value };
  return { label: h.title, value: h.body };
}

export default function SectionHero({
  slides,
  autoplayMs = 4500,

  className,
  badge,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  leftImage,
  rightImage,
  highlights,
}: {
  slides?: Slide[];
  autoplayMs?: number;

  className?: string;
  badge?: string;
  title?: string;
  subtitle?: string;
  primaryCta?: HomeCta;
  secondaryCta?: HomeCta;
  leftImage?: HomeImage;
  rightImage?: HomeImage;
  highlights?: Highlight[];
}) {
  const normalizedSlides: Slide[] = useMemo(() => {
    if (Array.isArray(slides) && slides.length) return slides;

    const fallback: Slide = {
      id: "fallback",
      className,
      badge,
      title: title ?? "Scopri le novità",
      subtitle,
      primaryCta,
      secondaryCta,
      leftImage,
      rightImage,
      highlights,
    };

    return [fallback];
  }, [
    slides,
    className,
    badge,
    title,
    subtitle,
    primaryCta,
    secondaryCta,
    leftImage,
    rightImage,
    highlights,
  ]);

  const [index, setIndex] = useState(0);
  const count = normalizedSlides.length;

  const goPrev = () => setIndex((i) => (i - 1 + count) % count);
  const goNext = () => setIndex((i) => (i + 1) % count);

  useEffect(() => {
    if (count <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, Math.max(2500, autoplayMs));
    return () => window.clearInterval(id);
  }, [count, autoplayMs]);

  // Swipe (mobile)
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef<number>(0);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    touchDeltaX.current = 0;
  }

  function onTouchMove(e: React.TouchEvent) {
    const x = e.touches[0]?.clientX ?? null;
    if (touchStartX.current == null || x == null) return;
    touchDeltaX.current = x - touchStartX.current;
  }

  function onTouchEnd() {
    const dx = touchDeltaX.current;
    touchStartX.current = null;
    touchDeltaX.current = 0;

    if (Math.abs(dx) < 40) return;
    if (dx > 0) goPrev();
    else goNext();
  }

  const slide = normalizedSlides[index];
  const imgLeft = slide.leftImage;
  const imgRight = slide.rightImage;

  const hl = (slide.highlights ?? []).map(normalizeHighlight);

  return (
    <section className={["w-full", slide.className ?? ""].join(" ").trim()} aria-label="Hero">
      <div
        className={[
          "relative w-full overflow-hidden",
          "rounded-none md:rounded-3xl",
          "border-y md:border border-border",
          "bg-background",
        ].join(" ")}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* ✅ MOBILE: full background image + overlay scuro (come prima) */}
        {imgRight?.src ? (
          <div className="absolute inset-0 md:hidden">
            <Image
              src={imgRight.src}
              alt={imgRight.alt ?? ""}
              fill
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.62),rgba(0,0,0,0.18),rgba(0,0,0,0.05))]" />
          </div>
        ) : (
          <div className="absolute inset-0 md:hidden bg-[linear-gradient(to_right,rgba(0,0,0,0.10),rgba(0,0,0,0.02))]" />
        )}

        {/* ✅ DESKTOP: fondo pulito + micro-gradiente elegante */}
        <div className="absolute inset-0 hidden md:block" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(1200px_520px_at_10%_15%,rgba(0,0,0,0.045),transparent_60%)]" />
          <div className="absolute inset-x-0 top-0 h-20 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.028),transparent)]" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(to_top,rgba(0,0,0,0.018),transparent)]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4">
          {/* ✅ DESKTOP 2 colonne: testo (sx) + immagini (dx) */}
          <div className="grid items-center gap-8 py-10 md:grid-cols-12 md:gap-10 md:py-16 lg:gap-14 lg:py-20">
            {/* TESTO */}
            <div className="md:col-span-6 lg:col-span-6">
              {slide.badge ? (
                <div
                  className={[
                    "inline-flex items-center rounded-full",
                    "border border-border bg-background/85 px-3.5 py-1.5",
                    "text-xs font-extrabold text-text backdrop-blur",
                    "md:shadow-[0_1px_0_rgba(0,0,0,0.02)]",
                  ].join(" ")}
                >
                  {slide.badge}
                </div>
              ) : null}

              <h1 className="mt-4 text-3xl font-extrabold leading-tight md:mt-5 md:text-6xl md:leading-[1.05] md:tracking-tight lg:text-6xl">
                {/* mobile deve restare identico: testo chiaro su overlay */}
                <span className="md:text-text text-text-on-dark">{slide.title}</span>
              </h1>

              {slide.subtitle ? (
                <p className="mt-3 max-w-xl text-sm font-medium md:mt-4 md:max-w-2xl md:text-lg md:leading-relaxed">
                  <span className="md:text-text/70 text-text-on-dark/90">{slide.subtitle}</span>
                </p>
              ) : null}

              {(slide.primaryCta || slide.secondaryCta) ? (
                <div className="mt-6 flex flex-wrap items-center gap-3 md:mt-7 md:gap-3.5">
                  {slide.primaryCta ? (
                    <Link
                      href={slide.primaryCta.href}
                      className={[
                        "inline-flex h-11 items-center justify-center rounded-full",
                        "bg-primary px-7 text-sm font-extrabold text-primary-contrast",
                        "hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        "shadow-sm md:shadow-md",
                        "md:h-12 md:px-8",
                        "md:transition md:hover:-translate-y-0.5 md:hover:shadow-lg",
                      ].join(" ")}
                    >
                      {slide.primaryCta.label}
                    </Link>
                  ) : null}

                  {slide.secondaryCta ? (
                    <Link
                      href={slide.secondaryCta.href}
                      className={[
                        "inline-flex h-11 items-center justify-center rounded-full",
                        "border border-border px-7 text-sm font-extrabold",
                        // desktop clean (secondary neutra)
                        "md:bg-background md:text-text/90 md:hover:bg-surface-2",
                        "md:h-12 md:px-8 md:shadow-none",
                        // mobile overlay: deve essere leggibile (INVARIATO come intent)
                        "bg-white/90 text-text hover:bg-white",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      ].join(" ")}
                    >
                      {slide.secondaryCta.label}
                    </Link>
                  ) : null}
                </div>
              ) : null}

              {/* Highlights: desktop pulite, su mobile restano leggibili */}
              {hl.length ? (
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:mt-7 lg:grid-cols-3 lg:gap-3.5">
                  {hl.slice(0, 6).map((h, i) => (
                    <div
                      key={`${slide.id}-hl-${i}`}
                      className={[
                        "rounded-2xl border border-border px-4 py-3",
                        "bg-background/85 backdrop-blur",
                        "md:shadow-[0_1px_0_rgba(0,0,0,0.02)]",
                      ].join(" ")}
                    >
                      <div className="text-sm font-extrabold text-text smart-wrap">{h.label}</div>
                      {h.value ? (
                        <div className="mt-0.5 text-xs text-muted-text smart-wrap">{h.value}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* IMMAGINI (desktop) */}
            <div className="hidden md:col-span-6 md:block lg:col-span-6">
              <div className="relative">
                {/* Main image */}
                <div
                  className={[
                    "relative aspect-[16/10] w-full overflow-hidden rounded-3xl",
                    "border border-border bg-surface shadow-sm",
                    "md:shadow-md",
                  ].join(" ")}
                >
                  {imgRight?.src ? (
                    <Image
                      src={imgRight.src}
                      alt={imgRight.alt ?? ""}
                      fill
                      sizes="(min-width: 1024px) 560px, 46vw"
                      className="object-cover"
                      loading="lazy"
                    />
                  ) : null}
                </div>

                {/* Secondary image overlapped */}
                {imgLeft?.src ? (
                  <div className="absolute -bottom-7 left-10 w-[240px] overflow-hidden rounded-3xl border border-border bg-background shadow-md">
                    <div className="relative aspect-[4/3]">
                      <Image
                        src={imgLeft.src}
                        alt={imgLeft.alt ?? ""}
                        fill
                        sizes="240px"
                        className="object-cover"
                        priority={index === 0}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              {/* spazio per overlap */}
              {imgLeft?.src ? <div className="h-10" /> : null}
            </div>
          </div>
        </div>

        {/* CONTROLS (desktop) */}
        {count > 1 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden md:block">
            <div className="pointer-events-auto mx-auto flex max-w-7xl items-center justify-between px-4 pb-5">
              <div className="flex items-center gap-2">
                <Arrow dir="prev" onClick={goPrev} />
                <Arrow dir="next" onClick={goNext} />
              </div>

              <div className="flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-2 backdrop-blur">
                {normalizedSlides.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setIndex(i)}
                    className="grid place-items-center"
                    aria-label={`Vai alla slide ${i + 1}`}
                    aria-current={i === index ? "true" : undefined}
                  >
                    <Dot active={i === index} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
