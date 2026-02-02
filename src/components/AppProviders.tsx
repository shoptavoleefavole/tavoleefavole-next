"use client";

import { CartProvider } from "@/components/cart/CartProvider";

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}
