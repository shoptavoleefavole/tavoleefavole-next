"use client";

import React, { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";

// bottone super-robusto: accetta id number o string
export default function AddToCartButton(props: {
  id: string | number;
  slug: string;
  name: string;
  image?: string;
  price: number;
  qty?: number;
  className?: string;
}) {
  const { addItem } = useCart();
  const [busy, setBusy] = useState(false);

  const qty = Math.max(1, Number.isFinite(props.qty) ? (props.qty as number) : 1);

  return (
    <button
      type="button"
      disabled={busy}
      className={props.className}
      onClick={() => {
        try {
          setBusy(true);

          // CartProvider vuole: id, slug, name, image, price
          const productForCart = {
            id: String(props.id),
            slug: props.slug,
            name: props.name,
            image: props.image || "/brand/tavoleefavole-logo.svg",
            price: Number(props.price) || 0,
          } as any;

          addItem(productForCart, qty);
        } finally {
          // micro-delay solo per evitare doppio click
          setTimeout(() => setBusy(false), 200);
        }
      }}
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #ddd",
        cursor: busy ? "not-allowed" : "pointer",
        fontWeight: 900,
      }}
    >
      {busy ? "Aggiungo..." : "Aggiungi al carrello"}
    </button>
  );
}
