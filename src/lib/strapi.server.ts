export type StrapiProductMini = {
  id: number;
  documentId?: string | null;
  name: string;
  slug: string;
  imageUrl: string | null;
  price: number | null;

  // ✅ inventario
  stockQty: number | null;
  trackInventory: boolean | null;
};

function baseUrl(raw: string) {
  return String(raw || "").replace(/\/+$/, "");
}

function toNumberOrNull(v: unknown): number | null {
  // Strapi decimal spesso è string: "3.00"
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function toIntOrNull(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

function toBoolOrNull(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  return null;
}

function absolutizeUrl(strapiBase: string, maybeRelative: unknown): string | null {
  const u = typeof maybeRelative === "string" ? maybeRelative.trim() : "";
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("/")) return `${baseUrl(strapiBase)}${u}`;
  return `${baseUrl(strapiBase)}/${u}`;
}

export async function getProductBySlug(slug: string): Promise<StrapiProductMini | null> {
  const STRAPI_URL = process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "";
  const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || "";

  if (!STRAPI_URL) throw new Error("Missing STRAPI_URL");
  if (!STRAPI_API_TOKEN) throw new Error("Missing STRAPI_API_TOKEN");

  const qs = new URLSearchParams();
  qs.set("filters[slug][$eq]", slug);
  qs.set("pagination[pageSize]", "1");

  // ✅ includi inventario nei fields
  qs.set("fields[0]", "name");
  qs.set("fields[1]", "slug");
  qs.set("fields[2]", "price");
  qs.set("fields[3]", "stockQty");
  qs.set("fields[4]", "trackInventory");

  // immagini: solo url
  qs.set("populate[images][fields][0]", "url");

  const url = `${baseUrl(STRAPI_URL)}/api/products?${qs.toString()}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Strapi fetch failed (${res.status})`);

  const json = await res.json().catch(() => null);
  const row = json?.data?.[0];
  if (!row) return null;

  // Supporta sia formato {id, attributes:{...}} che eventuali variazioni
  const a = row?.attributes ?? row;

  const imgRel = a?.images?.data?.[0]?.attributes?.url ?? null;
  const imgAbs = absolutizeUrl(STRAPI_URL, imgRel);

  return {
    id: Number(row.id),
    documentId: typeof row.documentId === "string" ? row.documentId : null,
    name: String(a?.name ?? "").trim(),
    slug: String(a?.slug ?? "").trim(),
    price: toNumberOrNull(a?.price),
    imageUrl: imgAbs,

    stockQty: toIntOrNull(a?.stockQty),
    trackInventory: toBoolOrNull(a?.trackInventory),
  };
}
