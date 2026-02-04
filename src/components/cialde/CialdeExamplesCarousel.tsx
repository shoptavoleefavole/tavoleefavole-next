"use client";

import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState } from "react";

type Slide = {
  src: string;
  alt: string;
  caption?: string;
};

const DEFAULT_SLIDES: Slide[] = [
  { src: "/cialde/esempio-1.jpg", alt: "Cialda personalizzata esempio 1", caption: "Tanti auguri Max" },
  { src: "/cialde/esempio-2.jpg", alt: "Cialda personalizzata esempio 2", caption: "Buon Compleanno!" },
  { src: "/cialde/esempio-3.jpg", alt: "Cialda personalizzata esempio 3", caption: "Benvenuta Emma" },
  { src: "/cialde/esempio-4.jpg", alt: "Cialda personalizzata esempio 4", caption: "Happy Birthday" },
];

function clampIntervalMs(v: unknown, fallback = 2800) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  // Evitiamo valori troppo bassi o troppo alti
  return Math.min(12000, Math.max(1200, Math.floor(n)));
}

function safeSlides(input?: Slide[]) {
  const arr = Array.isArray(input) ? input : [];
  // Teniamo solo slide valide (src e alt non vuoti)
  const cleaned = arr
    .map((s) => ({
      src: String(s?.src ?? "").trim(),
      alt: String(s?.alt ?? "").trim(),
      caption: s?.caption == null ? undefined : String(s.caption),
    }))
    .filter((s) => s.src.length > 0 && s.alt.length > 0);

  return cleaned.length > 0 ? cleaned : DEFAULT_SLIDES;
}

export default function CialdeExamplesCarousel({
  slides,
  intervalMs = 2800,
  autoPlay = true,
}: {
  slides?: Slide[];
  intervalMs?: number;
  autoPlay?: boolean;
}) {
  const carouselId = useId();
  const listId = `${carouselId}-slides`;

  const finalSlides = useMemo(() => safeSlides(slides), [slides]);
  const ms = useMemo(() => clampIntervalMs(intervalMs, 2800), [intervalMs]);

  const [i, setI] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const pausedByVisibility = useRef(false);

  // Se cambia la lista slide e l'indice è fuori range, lo resettiamo
  useEffect(() => {
    if (i >= finalSlides.length) setI(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalSlides.length]);

  // prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(!!mq.matches);
    apply();
    // compat
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
    mq.addListener?.(apply);
    return () => mq.removeListener?.(apply);
  }, []);

  // Pausa quando tab non visibile
  useEffect(() => {
    if (typeof document === "undefined") return;

    const onVis = () => {
      const hidden = document.visibilityState !== "visible";
      pausedByVisibility.current = hidden;
      // se torna visibile, riparte solo se l'utente non ha messo pausa manuale
    };

    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Autoplay
  useEffect(() => {
    if (!autoPlay) return;
    if (reducedMotion) return;
    if (isPaused) return;
    if (pausedByVisibility.current) return;
    if (!finalSlides.length) return;

    const t = window.setInterval(() => {
      setI((x) => (x + 1) % finalSlides.length);
    }, ms);

    return () => window.clearInterval(t);
  }, [autoPlay, reducedMotion, isPaused, finalSlides, ms]);

  const active = finalSlides[i] ?? finalSlides[0];

  function goNext() {
    setI((x) => (x + 1) % finalSlides.length);
  }

  function goPrev() {
    setI((x) => (x - 1 + finalSlides.length) % finalSlides.length);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      goNext();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goPrev();
    }
  }

  // Pausa su hover/touch per evitare “fastidio” mentre guardano le immagini
  function pause() {
    setIsPaused(true);
  }
  function resume() {
    setIsPaused(false);
  }

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-border bg-surface"
      role="region"
      aria-roledescription="carousel"
      aria-label="Esempi di cialde personalizzate"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onTouchStart={pause}
      onTouchEnd={resume}
    >
      <div className="relative aspect-[16/10]">
        <Image
          src={active.src}
          alt={active.alt}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
          priority
        />

        {/* overlay caption */}
        {active.caption ? (
          <div className="absolute inset-x-0 bottom-0 p-4">
            <div className="inline-flex max-w-full items-center rounded-2xl border border-border bg-background/90 px-3 py-2 text-sm font-extrabold">
              {active.caption}
            </div>
          </div>
        ) : null}

        {/* Prev/Next */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-between px-3">
          <button
            type="button"
            onClick={goPrev}
            className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full border border-border bg-background/85 text-sm font-extrabold hover:bg-background"
            aria-controls={listId}
            aria-label="Immagine precedente"
          >
            ‹
          </button>

          <button
            type="button"
            onClick={goNext}
            className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full border border-border bg-background/85 text-sm font-extrabold hover:bg-background"
            aria-controls={listId}
            aria-label="Immagine successiva"
          >
            ›
          </button>
        </div>
      </div>

      {/* dots + status */}
      <div className="flex items-center justify-between gap-3 p-3">
        <div id={listId} className="flex items-center justify-center gap-2">
          {finalSlides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setI(idx)}
              aria-label={`Vai alla slide ${idx + 1}`}
              className={[
                "h-2.5 w-2.5 rounded-full border border-border transition",
                idx === i ? "bg-primary" : "bg-background",
              ].join(" ")}
            />
          ))}
        </div>

        <div className="text-xs font-semibold text-text/60">
          {i + 1}/{finalSlides.length}
        </div>
      </div>
    </div>
  );
}
