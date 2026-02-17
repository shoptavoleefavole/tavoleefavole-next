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

export function getCategoryBySlug(slug: string): Category | undefined {
  // keep signature stable, avoid unused param warnings
  void slug;
  return undefined;
}

export function getProductBySlug(slug: string): Product | undefined {
  void slug;
  return undefined;
}

export function getProductsByCategory(slug: string): Product[] {
  void slug;
  return [];
}

export function getOccasionBySlug(slug: string): Occasion | undefined {
  void slug;
  return undefined;
}

export function getCurrentOccasion(): Occasion {
  return {
    slug: "befana",
    name: "Befana",
    description: "",
    heroImage: "",
    productIds: [],
  };
}

export function getProductsForOccasion(slug: string): Product[] {
  void slug;
  return [];
}
