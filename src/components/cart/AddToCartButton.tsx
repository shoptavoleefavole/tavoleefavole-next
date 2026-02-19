"use client";

import React, { useMemo, useState } from "react";
import { useCart, type CartItemMeta } from "@/components/cart/CartProvider";

type Props = {
  /**
   * Identificatore prodotto usato dal frontend (oggi lo passi già).
   * Su Strapi 5 conviene che sia il documentId.
   */
  id: string | number;

  /**
   * ✅ (Opzionale ma consigliato) documentId Strapi 5 del prodotto.
   * Se lo passi, verrà usato come chiave per scalare lo stock in modo sicuro.
   * Se NON lo passi, useremo id come fallback.
   */
  productDocumentId?: string;

  slug: string;
  name: string;
  image?: string;
  price: number;

  /** quantità da aggiungere (default 1) */
  qty?: number;

  /** classi tailwind */
  className?: string;

  /** testo bottone */
  label?: string;

  /** testo durante loading */
  loadingLabel?: string;

  /** testo quando disabilitato per stock */
  disabledLabel?: string;

  /** disabilita il bottone (forzato) */
  disabled?: boolean;

  /** fallback legacy */
  inStock?: boolean;

  /** quantità stock (se presente, guida la disponibilità) */
  stockQty?: number | null;

  /** se false, sempre acquistabile */
  trackInventory?: boolean;

  /** meta per prodotti personalizzati */
  meta?: CartItemMeta;

  /** callback dopo aggiunta */
  onAdded?: () => void;
};

const FALLBACK_IMAGE = "/brand/tavoleefavole-logo.svg";

function toSafeString(v: unknown, fallback = ""): string {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
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

function toFiniteNumberOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function AddToCartButton({
  id,
  productDocumentId,
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
  stockQty,
  trackInventory,
  meta,
  onAdded,
}: Props) {
  const { addItem } = useCart();
  const [busy, setBusy] = useState(false);

  const normalized = useMemo(() => {
    const normalizedId = toSafeString(id);
    const normalizedDocId = toSafeString(productDocumentId) || normalizedId; // ✅ fallback su id

    const normalizedSlug = toSafeString(slug);
    const normalizedName = toSafeString(name, "Prodotto");
    const normalizedImage = toSafeString(image, FALLBACK_IMAGE) || FALLBACK_IMAGE;
    const normalizedPrice = toSafePrice(price);
    const normalizedQty = toSafeQty(qty);

    return {
      id: normalizedId,
      productDocumentId: normalizedDocId, // ✅ chiave robusta per Strapi 5
      slug: normalizedSlug,
      name: normalizedName,
      image: normalizedImage,
      price: normalizedPrice,
      qty: normalizedQty,
    };
  }, [id, productDocumentId, slug, name, image, price, qty]);

  /**
   * ✅ Disponibilità robusta:
   * 1) trackInventory === false => sempre acquistabile
   * 2) stockQty numero => acquistabile solo se > 0
   * 3) fallback su inStock (legacy)
   */
  const track = trackInventory !== false; // default true
  const stockNumber = stockQty === null ? null : toFiniteNumberOrNull(stockQty);

  const computedInStock =
    track === false ? true : stockNumber !== null ? stockNumber > 0 : inStock !== false;

  // Se lo stock è noto e track=true, impedisci di aggiungere più di quanto disponibile
  const exceedsKnownStock =
    track !== false &&
    stockNumber !== null &&
    Number.isFinite(stockNumber) &&
    stockNumber >= 0 &&
    normalized.qty > stockNumber;

  // Regole “sicure” (non aggiungere roba invalida)
  const isUnavailable = computedInStock === false;
  const isNotBuyable = normalized.price <= 0 || !normalized.id || !normalized.slug;

  const isDisabled = busy || disabled || isUnavailable || isNotBuyable || exceedsKnownStock;

  async function handleClick() {
    if (isDisabled) return;

    try {
      setBusy(true);

      /**
       * ✅ Item compatibile con l'attuale CartProvider:
       * - mantiene i campi esistenti
       * - aggiunge productDocumentId (Strapi 5)
       * - aggiunge productId (legacy) così non rompi niente se altrove lo usi
       */
      const item = {
        id: normalized.id,
        productId: normalized.id, // legacy/fallback
        productDocumentId: normalized.productDocumentId, // ✅ per stock su Strapi 5
        slug: normalized.slug,
        name: normalized.name,
        image: normalized.image,
        price: normalized.price,
      };

      // addItem(...) può essere sincrona o async: gestiamo entrambi i casi
      await Promise.resolve(
        addItem(item as any, normalized.qty, meta, {
          inStock: computedInStock,
          stockQty: stockNumber,
          trackInventory: track,
        })
      );

      onAdded?.();
    } catch (err) {
      console.error("AddToCartButton: addItem failed", err);
    } finally {
      // anti spam-click (micro delay)
      window.setTimeout(() => setBusy(false), 200);
    }
  }

  const computedClassName =
    className ??
    "h-11 w-full rounded-xl border border-border bg-background px-4 text-sm font-extrabold hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const title = exceedsKnownStock
    ? `Disponibilità insufficiente (max ${stockNumber})`
    : isUnavailable
      ? "Prodotto non disponibile"
      : isNotBuyable
        ? "Prodotto non acquistabile"
        : busy
          ? loadingLabel
          : label;

  const text = busy
    ? loadingLabel
    : exceedsKnownStock
      ? "Disponibilità insufficiente"
      : isUnavailable
        ? disabledLabel
        : isNotBuyable
          ? "Non acquistabile"
          : label;

  return (
    <button
      type="button"
      disabled={isDisabled}
      className={computedClassName}
      onClick={handleClick}
      aria-label={text}
      title={title}
      data-in-stock={String(computedInStock)}
      data-track-inventory={String(track)}
      data-stock={stockNumber == null ? "" : String(stockNumber)}
      data-product-doc-id={normalized.productDocumentId}
    >
      {text}
    </button>
  );
}
