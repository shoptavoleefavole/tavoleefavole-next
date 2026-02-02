import type { MetadataRoute } from "next";
import { macroCategories } from "@/data/categories";
import { getAllProducts } from "@/lib/catalog";

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  const now = new Date();

  // Pagine statiche principali
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/catalogo`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/carrello`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${siteUrl}/account`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/supporto`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];

  // Categorie + sottocategorie
  const categoryRoutes: MetadataRoute.Sitemap = (Array.isArray(macroCategories) ? macroCategories : []).flatMap(
    (m) => {
      const macroUrl = `${siteUrl}/categoria/${m.slug}`;
      const subUrls = (m.subcategories ?? []).map((s) => ({
        url: `${siteUrl}/categoria/${m.slug}/${s.slug}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));

      return [
        {
          url: macroUrl,
          lastModified: now,
          changeFrequency: "weekly",
          priority: 0.8,
        },
        ...subUrls,
      ];
    }
  );

  // Prodotti
  const products = getAllProducts();
  const productRoutes: MetadataRoute.Sitemap = (Array.isArray(products) ? products : []).map((p: any) => ({
    url: `${siteUrl}/prodotto/${p.slug ?? p.id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // Ricorrenze (hardcoded perché in build vedo 4 slug già noti)
  const ricorrenzeRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/ricorrenze/pasqua`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${siteUrl}/ricorrenze/san-valentino`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${siteUrl}/ricorrenze/natale`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${siteUrl}/ricorrenze/befana`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
  ];

  return [...staticRoutes, ...categoryRoutes, ...productRoutes, ...ricorrenzeRoutes];
}
