"use client";

import type { Product } from "@/lib/types";
import Button from "@/components/ui/Button";
import { useCart } from "@/components/cart/CartProvider";

export default function AddToCartButton({ product }: { product: Product }) {
  const { addItem } = useCart();

  return (
    <Button
      type="button"
      className="w-full"
      disabled={!product.inStock}
      onClick={() => addItem(product, 1)}
      aria-label="Aggiungi al carrello"
    >
      {product.inStock ? "Aggiungi al carrello" : "Non disponibile"}
    </Button>
  );
}
