// src/app/sitemap.ts
import type { MetadataRoute } from "next";
import { macroCategories } from "@/data/categories";
import { getAllProducts } from "@/lib/catalog";

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.tavoleefavole.com"
  ).replace(/\/+$/, "");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/catalogo`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/supporto`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = (
    Array.isArray(macroCategories) ? macroCategories : []
  ).flatMap((m) => {
    const macroUrl = `${siteUrl}/categoria/${m.slug}`;
    const subUrls = (m.subcategories ?? []).map((s) => ({
      url: `${siteUrl}/categoria/${m.slug}/${s.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    return [
      { url: macroUrl, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
      ...subUrls,
    ];
  });

  const allProducts = await getAllProducts();
  const productRoutes: MetadataRoute.Sitemap = (Array.isArray(allProducts) ? allProducts : [])
    .filter((p: any) => p?.visibleInStorefront !== false && Boolean(p?.slug))
    .map((p: any) => ({
      url: `${siteUrl}/prodotto/${p.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    }));

  const occasioniRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/occasione/natale`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/occasione/befana`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/occasione/san-valentino`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/occasione/pasqua`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  return [...staticRoutes, ...categoryRoutes, ...productRoutes, ...occasioniRoutes];
}