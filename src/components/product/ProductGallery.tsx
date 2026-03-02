"use client";

import { useMemo, useState } from "react";

// ✅ Cloudinary: inserisce trasformazioni tra /upload/ e il path
// Riduce drasticamente il peso senza perdita visibile di qualità
function cloudinaryOptimize(
  url: string,
  width: number,
  quality: "auto" | "auto:best" | "auto:good" | "auto:eco" | "auto:low" = "auto"
): string {
  if (!url || typeof url !== "string") return url;
  try {
    const m = url.match(
      /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/
    );
    if (!m) return url;
    const [, base, rest] = m;

    // ✅ Evita doppia trasformazione se sono già presenti (es. small_, thumbnail_)
    if (/^[a-z_,]+[_,]/.test(rest)) return url;

    return `${base}f_auto,q_${quality},w_${width},c_limit/${rest}`;
  } catch {
    return url;
  }
}

// srcSet responsive per immagine principale
function buildSrcSet(url: string): string {
  return [
    `${cloudinaryOptimize(url, 480)} 480w`,
    `${cloudinaryOptimize(url, 800)} 800w`,
    `${cloudinaryOptimize(url, 1200)} 1200w`,
  ].join(", ");
}

// ✅ Sanitizza alt text: rimuove caratteri di controllo
function safeAlt(v: unknown): string {
  return String(v ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 200);
}

export default function ProductGallery({
  images,
  alt,
}: {
  images?: string[] | null;
  alt: string;
}) {
  const safeAltText = safeAlt(alt);
  const list = useMemo(() => (images?.length ? images : []), [images]);
  const [active, setActive] = useState(0);

  const currentRaw = list[active] ?? null;

  // ✅ Immagine principale: 1200px max, qualità auto (Cloudinary sceglie WebP/AVIF)
  const current = useMemo(
    () => (currentRaw ? cloudinaryOptimize(currentRaw, 1200, "auto") : null),
    [currentRaw]
  );

  const currentSrcSet = useMemo(
    () => (currentRaw ? buildSrcSet(currentRaw) : undefined),
    [currentRaw]
  );

  if (!current) {
    return (
      <div className="rounded-2xl border border-border bg-surface-2/60 p-6 text-sm text-text/70">
        Nessuna immagine disponibile.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {/* ✅ Immagine principale: overflow-hidden + group per zoom on hover */}
      <div className="group overflow-hidden rounded-2xl border border-border bg-surface-2/60">
        <div className="aspect-[4/3] w-full">
          <img
            src={current}
            srcSet={currentSrcSet}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 60vw, 800px"
            alt={safeAltText}
            // ✅ object-contain: mostra il prodotto intero senza tagliarlo
            // ✅ group-hover:scale-110: zoom fluido on hover
            className="h-full w-full object-contain transition-transform duration-500 ease-out group-hover:scale-110 cursor-zoom-in"
            loading="eager"
            draggable={false}
          />
        </div>
      </div>

      {/* Thumbnails */}
      {list.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {list.map((src, i) => {
            // ✅ Thumbnails: 120px, qualità eco (peso minimo)
            const thumbSrc = cloudinaryOptimize(src, 120, "auto:eco");
            const isActive = i === active;
            return (
              <button
                key={src + i}
                type="button"
                onClick={() => setActive(i)}
                className={[
                  "shrink-0 overflow-hidden rounded-xl border transition-colors duration-150",
                  isActive
                    ? "border-primary ring-1 ring-primary/30"
                    : "border-border hover:border-primary/50",
                  "bg-surface-2/60",
                ].join(" ")}
                aria-label={`Seleziona immagine ${i + 1}`}
                aria-pressed={isActive}
              >
                <div className="h-16 w-20">
                  <img
                    src={thumbSrc}
                    alt={`${safeAltText} - miniatura ${i + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    draggable={false}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
