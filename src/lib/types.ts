export type TaxonomyRef = {
  slug: string;
  label: string;
};

export type Category = {
  slug: string;
  name: string;
  description: string;
  image?: string;
};

export type ProductVariant = {
  sku?: string | null;
};

export type Product = {
  // Identità
  id: string;
  documentId?: string | null;
  slug: string;
  name: string;

  // Prezzi
  price: number;
  compareAtPrice?: number | null;

  // Marketing / UI (legacy + utili)
  badge?: string | null;
  rating?: number | null;
  ratingCount?: number | null;

  // Stock (in alcune parti del progetto lo trattate come opzionale)
  inStock?: boolean;

  isNew?: boolean;

  shortDescription?: string;

  // Strapi può essere string o richtext json → meglio any per robustezza
  description?: any;

  // Specifiche: a volte array, a volte null
  specs?: { label: string; value: string }[] | any;

  // Taxonomy "nuova" (Strapi normalize)
  category?: TaxonomyRef | null;
  subcategory?: TaxonomyRef | null;

  // Taxonomy "legacy" (componenti vecchi)
  categorySlug?: string;
  subSlug?: string;

  // Immagini
  image?: string; // ✅ non null
  images?: string[];

  // Varianti
  variants?: ProductVariant[];

  // SEO
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoImage?: string | null;
};

export type Occasion = {
  slug: "pasqua" | "san-valentino" | "natale" | "befana";
  name: string;
  description: string;
  heroImage: string;
  productIds: string[];
};
