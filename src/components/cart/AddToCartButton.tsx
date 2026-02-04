"use client";

import React, { useMemo, useState } from "react";
import { useCart, type CartItemMeta } from "@/components/cart/CartProvider";

type Props = {
  id: string | number;
  slug: string;
  name: string;
  image?: string;
  price: number;

  /** quantità da aggiungere (default 1) */
  qty?: number;

  /** classi tailwind (se presenti, non usiamo inline style) */
  className?: string;

  /** opzionale: testo bottone */
  label?: string;

  /** opzionale: testo durante loading */
  loadingLabel?: string;

  /** opzionale: testo quando disabilitato (es. esaurito) */
  disabledLabel?: string;

  /** se true, disabilita il bottone (forzato) */
  disabled?: boolean;

  /** se false, NON può entrare nel carrello (UI + sicurezza) */
  inStock?: boolean;

  /** opzionale: meta per prodotti personalizzati (es. cialde) */
  meta?: CartItemMeta;

  /** opzionale: cosa fare dopo l'aggiunta (es. redirect) */
  onAdded?: () => void;
};

const FALLBACK_IMAGE = "/brand/tavoleefavole-logo.svg";

function toSafeString(v: unknown, fallback = ""): string {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function toSafePrice(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function toSafeQty(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

export default function AddToCartButton({
  id,
  slug,
  name,
  image,
  price,
  qty,
  className,
  label = "Aggiungi al carrello",
  loadingLabel = "Aggiungo...",
  disabledLabel = "Non disponibile",
  disabled = false,
  inStock = true,
  meta,
  onAdded,
}: Props) {
  const { addItem } = useCart();
  const [busy, setBusy] = useState(false);

  const normalized = useMemo(() => {
    const normalizedId = toSafeString(id);
    const normalizedSlug = toSafeString(slug);
    const normalizedName = toSafeString(name, "Prodotto");
    const normalizedImage = toSafeString(image, FALLBACK_IMAGE) || FALLBACK_IMAGE;
    const normalizedPrice = toSafePrice(price);
    const normalizedQty = toSafeQty(qty);

    return {
      id: normalizedId,
      slug: normalizedSlug,
      name: normalizedName,
      image: normalizedImage,
      price: normalizedPrice,
      qty: normalizedQty,
    };
  }, [id, slug, name, image, price, qty]);

  // Regole di disabilitazione “a prova di sicurezza”
  const isUnavailable = inStock === false;
  const isNotBuyable = normalized.price <= 0 || !normalized.id || !normalized.slug;
  const isDisabled = busy || disabled || isUnavailable || isNotBuyable;

  async function handleClick() {
    if (isDisabled) return;

    try {
      setBusy(true);

      await Promise.resolve(
        addItem(
          {
            // coerente con CartProvider: id/slug obbligatori
            id: normalized.id,
            slug: normalized.slug,
            name: normalized.name,
            image: normalized.image,
            price: normalized.price,
          } as any,
          normalized.qty,
          meta,
          { inStock }
        )
      );

      onAdded?.();
    } catch (err) {
      console.error("AddToCartButton: addItem failed", err);
    } finally {
      // anti spam click
      window.setTimeout(() => setBusy(false), 200);
    }
  }

  const computedClassName =
    className ??
    "h-11 w-full rounded-xl border border-border bg-background px-4 text-sm font-extrabold hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const title = isUnavailable
    ? "Prodotto non disponibile"
    : isNotBuyable
    ? "Prodotto non acquistabile"
    : busy
    ? loadingLabel
    : label;

  const text = busy ? loadingLabel : isUnavailable ? disabledLabel : isNotBuyable ? "Non acquistabile" : label;

  return (
    <button
      type="button"
      disabled={isDisabled}
      className={computedClassName}
      onClick={handleClick}
      aria-label={text}
      title={title}
      data-in-stock={String(inStock)}
      data-disabled={String(disabled)}
      style={
        // Se usi Tailwind (className), lo style non serve.
        // Ma se NON passi className, questo fallback mantiene un bottone decente.
        className
          ? undefined
          : {
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              cursor: isDisabled ? "not-allowed" : "pointer",
              fontWeight: 900,
            }
      }
    >
      {text}
    </button>
  );
}
