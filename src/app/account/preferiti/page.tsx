import type { Category, Product, Occasion } from "@/lib/types";

/**
 * DEPRECATO: MOCK DATA
 * Questo file conteneva categorie/prodotti/occasioni placeholder.
 * È stato svuotato per evitare che la UI mostri “prova”.
 *
 * Migrazione: tutte le pagine devono leggere da Strapi.
 */

export const CURRENT_OCCASION_SLUG: Occasion["slug"] = "befana";

export const categories: Category[] = [];
export const products: Product[] = [];
export const occasions: Occasion[] = [];

export function getCategoryBySlug(_slug: string): Category | undefined {
  return undefined;
}

export function getProductBySlug(_slug: string): Product | undefined {
  return undefined;
}

export function getProductsByCategory(_slug: string): Product[] {
  return [];
}

export function getOccasionBySlug(_slug: string): Occasion | undefined {
  return undefined;
}

export function getCurrentOccasion(): Occasion {
  // fallback safe
  return {
    slug: "befana",
    name: "Befana",
    description: "",
    heroImage: "",
    productIds: [],
  };
}

export function getProductsForOccasion(_slug: string): Product[] {
  return [];
}
