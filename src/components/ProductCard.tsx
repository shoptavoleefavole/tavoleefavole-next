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
  // Strapi 5: documentId è il migliore (string)
  const key = String(product?.documentId ?? product?.id ?? product?.slug ?? "").trim();
  return key;
}

function getSlug(product: any): string {
  return String(product?.slug ?? "").trim();
}

function getName(product: any): string {
  return String(product?.name ?? "").trim();
}

export default function ProductCard({ product }: { product: Product }) {
  const p: any = product;

  const slug = getSlug(p);
  const name = getName(p);
  const productKey = getProductKey(p);

  const imgSrc = (p?.image ?? undefined) as string | undefined;
  const badgeText = (p?.badge ?? undefined) as string | undefined;
  const inStock = p?.inStock;

  // Se manca lo slug non possiamo navigare correttamente: meglio non renderizzare link rotti
  const href = slug ? `/prodotto/${slug}` : "#";

  return (
    <div className="group overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="relative">
        {/* Link immagine */}
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
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 text-xs text-neutral-500">
              Nessuna immagine
            </div>
          )}
        </Link>

        {/* Badge (top-left) */}
        {badgeText ? (
          <div className="pointer-events-none absolute left-3 top-3 z-10">
            <Badge>{badgeText}</Badge>
          </div>
        ) : null}

        {/* Non disponibile (bottom-left) */}
        {inStock === false ? (
          <div className="pointer-events-none absolute left-3 bottom-3 z-10 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold">
            Non disponibile
          </div>
        ) : null}

        {/* Cuore (bottom-right) - Amazon-like:
            - su desktop appare al hover
            - su mobile rimane visibile */}
        {productKey ? (
          <div
            className={[
              "absolute bottom-2 right-2 z-30",
              "rounded-full bg-white/90 p-2 shadow",
              // desktop: nascosto finché non hover
              "opacity-100 md:opacity-0 md:group-hover:opacity-100",
              "transition-opacity duration-150",
            ].join(" ")}
          >
            <FavoriteToggleButton productId={productKey} />
          </div>
        ) : null}
      </div>

      {/* Testo */}
      <div className="p-4">
        <Link href={href} className="block">
          <div className="line-clamp-2 font-semibold">{name || "Prodotto"}</div>
        </Link>

        <div className="mt-2 flex items-baseline gap-2">
          <div className="font-bold">{formatEUR(p?.price)}</div>
        </div>
      </div>
    </div>
  );
}
