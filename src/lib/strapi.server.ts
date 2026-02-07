type StrapiProductMini = {
  id: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  price: number | null;
};

function baseUrl(raw: string) {
  return String(raw || "").replace(/\/+$/, "");
}

export async function getProductBySlug(slug: string): Promise<StrapiProductMini | null> {
  const STRAPI_URL = process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "";
  const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || "";

  if (!STRAPI_URL) throw new Error("Missing STRAPI_URL");
  if (!STRAPI_API_TOKEN) throw new Error("Missing STRAPI_API_TOKEN");

  const url =
    `${baseUrl(STRAPI_URL)}/api/products` +
    `?filters[slug][$eq]=${encodeURIComponent(slug)}` +
    `&fields[0]=name&fields[1]=slug&fields[2]=price` +
    `&populate[images][fields][0]=url` +
    `&pagination[pageSize]=1`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Strapi fetch failed (${res.status})`);

  const json = await res.json();
  const row = json?.data?.[0];
  if (!row) return null;

  const a = row.attributes ?? row;
  const img = a?.images?.data?.[0]?.attributes?.url ?? null;

  return {
    id: row.id,
    name: a.name,
    slug: a.slug,
    price: typeof a.price === "number" ? a.price : null,
    imageUrl: typeof img === "string" ? img : null,
  };
}
