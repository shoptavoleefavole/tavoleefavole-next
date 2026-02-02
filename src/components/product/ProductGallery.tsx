"use client";

import { useMemo, useState } from "react";

export default function ProductGallery({
  images,
  alt,
}: {
  images?: string[] | null;
  alt: string;
}) {
  const list = useMemo(() => (images && images.length ? images : []), [images]);
  const fallback = list.length ? list : [];
  const [active, setActive] = useState(0);

  const current = fallback[active] ?? fallback[0];

  if (!current) {
    return (
      <div className="rounded-2xl border border-border bg-surface-2/60 p-6 text-sm text-text/70">
        Nessuna immagine disponibile.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {/* Immagine grande */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface-2/60">
        <div className="aspect-[4/3]">
          <img
            src={current}
            alt={alt}
            className="h-full w-full object-cover"
            loading="eager"
          />
        </div>
      </div>

      {/* Thumbnails (stile “gallery” come e-commerce) */}
      {fallback.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {fallback.map((src, i) => {
            const isActive = i === active;
            return (
              <button
                key={src + i}
                type="button"
                onClick={() => setActive(i)}
                className={`shrink-0 overflow-hidden rounded-xl border ${
                  isActive ? "border-primary" : "border-border"
                } bg-surface-2/60`}
                aria-label={`Seleziona immagine ${i + 1}`}
              >
                <div className="h-16 w-20">
                  <img
                    src={src}
                    alt={`${alt} - miniatura ${i + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
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
