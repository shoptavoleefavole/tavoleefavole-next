// src/app/robots.ts
import type { MetadataRoute } from "next";

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.tavoleefavole.com"
  ).replace(/\/+$/, "");
}

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/account", "/carrello", "/checkout", "/debug"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}