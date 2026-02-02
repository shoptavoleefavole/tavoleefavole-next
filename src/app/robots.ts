import type { MetadataRoute } from "next";

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // se vuoi bloccare aree specifiche in futuro:
        // disallow: ["/debug", "/api"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
