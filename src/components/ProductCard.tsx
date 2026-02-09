import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Product } from "@/lib/types";

import Badge from "@/components/ui/Badge";
import FavoriteToggleButton from "@/components/favorites/FavoriteToggleButton";

function formatEUR(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "€ 0,00";
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
}

function getProductKey(product: any): string {
  return String(product?.documentId ?? product?.id ?? product?.slug ?? "").trim();
}

function getSlug(product: any): string {
  return String(product?.slug ?? "").trim();
}

function getName(product: any): string {
  return String(product?.name ?? "").trim();
}

function isRemoteStrapiUrl(src?: string) {
  if (!src) return false;
  return /^https?:\/\//i.test(src) && src.includes("onrender.com/uploads/");
}

function toFiniteNumberOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function ProductCard({
  product,
  footer,
}: {
  product: Product;
  footer?: ReactNode;
}) {
  const p: any = product;

  const slug = getSlug(p);
  const name = getName(p);
  const productKey = getProductKey(p);

  const imgSrc = (p?.image ?? undefined) as string | undefined;
  const badgeText = (p?.badge ?? undefined) as string | undefined;

  // ✅ Nuova logica inventario (robusta)
  // trackInventory: default true
  const trackInventory: boolean = p?.trackInventory !== false;

  // stockQty: deve essere numero
  const stockQty: number | null = toFiniteNumberOrNull(p?.stockQty);

  // ✅ "Non disponibile" SOLO se stockQty è presente ed è <= 0 (e trackInventory true)
  // Se stockQty non arriva (null), NON mostriamo "Non disponibile" per evitare falsi negativi.
  const isOutOfStock = trackInventory && stockQty !== null && stockQty <= 0;

  const href = slug ? `/prodotto/${slug}` : "#";
  const disableOptimizer = isRemoteStrapiUrl(imgSrc);

  return (
    <div className="group h-full overflow-hidden rounded-2xl border bg-white shadow-sm flex flex-col">
      <div className="relative">
        <Link
          href={href}
          aria-label={name ? `Apri ${name}` : "Apri prodotto"}
          className="relative block aspect-[4/3] overflow-hidden"
        >
          {imgSrc ? (
            <Image
              src={imgSrc}
              alt={name || "Prodotto"}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              // ✅ evita 504 se Strapi è lento
              unoptimized={disableOptimizer}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 text-xs text-neutral-500">
              Nessuna immagine
            </div>
          )}
        </Link>

        {badgeText ? (
          <div className="pointer-events-none absolute left-3 top-3 z-10">
            <Badge>{badgeText}</Badge>
          </div>
        ) : null}

        {/* ✅ Mostra SOLO se realmente esaurito */}
        {isOutOfStock ? (
          <div className="pointer-events-none absolute left-3 bottom-3 z-10 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold">
            Non disponibile
          </div>
        ) : null}

        {productKey ? (
          <div
            className={[
              "absolute bottom-2 right-2 z-30",
              "rounded-full bg-white/90 p-2 shadow",
              "opacity-100 md:opacity-0 md:group-hover:opacity-100",
              "transition-opacity duration-150",
            ].join(" ")}
          >
            <FavoriteToggleButton productId={productKey} />
          </div>
        ) : null}
      </div>

      {/* ✅ layout a colonna per allineare eventuale footer/CTA */}
      <div className="p-4 flex flex-col flex-1">
        <Link href={href} className="block">
          {/* min-h = altezze più uniformi tra card */}
          <div className="line-clamp-2 min-h-[2.75rem] font-semibold">{name || "Prodotto"}</div>
        </Link>

        <div className="mt-2 flex items-baseline gap-2">
          <div className="font-bold">{formatEUR(p?.price)}</div>
        </div>

        {/* ✅ Se in futuro vuoi mettere qui il bottone "Aggiungi al carrello",
            questo footer resta sempre allineato in basso */}
        {footer ? <div className="mt-auto pt-4">{footer}</div> : null}
      </div>
    </div>
  );
}
