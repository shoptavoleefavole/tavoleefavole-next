// src/lib/shipping.server.ts
export type ShippingZone = "IT_MAINLAND" | "IT_ISLANDS";

type CartItem = { productId: number; qty: number };

const STRAPI_URL = (process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "").replace(/\/+$/, "");
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN || "";

function requireEnv(name: string, value: string) {
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

async function fetchStrapi(path: string) {
  requireEnv("STRAPI_URL", STRAPI_URL);
  requireEnv("STRAPI_API_TOKEN", STRAPI_TOKEN);

  const res = await fetch(`${STRAPI_URL}${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${STRAPI_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Strapi error ${res.status} on ${path}: ${text}`);
  }
  return res.json();
}

function asInt(v: any): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function normalizePriceEur(v: any): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;

  // Se qualcuno ha salvato in "centesimi" (770, 1290, 2000)
  if (Number.isInteger(n) && n >= 100) return n / 100;

  return n;
}

export async function calculateShippingQuote(args: { items: CartItem[]; zone: ShippingZone }) {
  const { items, zone } = args;

  if (!items?.length) return { zone, weightTotalGrams: 0, shippingEur: 0 };

  // 1) Prendo i pesi prodotto da Strapi (server-side)
  const ids = Array.from(new Set(items.map((i) => i.productId))).filter((x) => Number.isFinite(x) && x > 0);

  const qs = new URLSearchParams();
  qs.set("pagination[pageSize]", "100");
  ids.forEach((id, i) => qs.append(`filters[id][$in][${i}]`, String(id)));
  qs.append("fields[0]", "weight_grams");

  const productsResp: any = await fetchStrapi(`/api/products?${qs.toString()}`);
  const list: any[] = Array.isArray(productsResp?.data) ? productsResp.data : [];

  const weightById = new Map<number, number>();
  for (const row of list) {
    const id = typeof row?.id === "number" ? row.id : null;
    const w = row?.attributes?.weight_grams ?? row?.weight_grams;
    const wi = asInt(w);
    if (id && wi && wi > 0) weightById.set(id, wi);
  }

  let weightTotalGrams = 0;
  const missing: number[] = [];

  for (const it of items) {
    const w = weightById.get(it.productId);
    if (!w) missing.push(it.productId);
    weightTotalGrams += (w ?? 0) * Math.max(1, Math.floor(it.qty));
  }

  if (missing.length) {
    throw new Error(`Missing weight_grams for productId(s): ${missing.join(", ")}`);
  }

  // 2) Prendo le fasce (accetto IT_ISLAND oltre IT_ISLANDS)
  const qs2 = new URLSearchParams();
  qs2.set("pagination[pageSize]", "200");
  qs2.set("filters[active][$eq]", "true");

  if (zone === "IT_ISLANDS") {
    qs2.append("filters[zone][$in][0]", "IT_ISLANDS");
    qs2.append("filters[zone][$in][1]", "IT_ISLAND");
  } else {
    qs2.set("filters[zone][$eq]", "IT_MAINLAND");
  }

  // ordinamento aiuta, ma non ci fidiamo e gestiamo overlap
  qs2.append("sort[0]", "min_weight_grams:asc");

  const ratesResp: any = await fetchStrapi(`/api/shipping-rates?${qs2.toString()}`);
  const rates: any[] = Array.isArray(ratesResp?.data) ? ratesResp.data : [];

  const bands = rates
    .map((r) => r?.attributes ?? r)
    .map((r) => ({
      min: asInt(r.min_weight_grams),
      max: asInt(r.max_weight_grams),
      price: normalizePriceEur(r.price_eur),
    }))
    .filter((b) => b.min != null && b.max != null && b.price != null && b.max >= b.min) as Array<{
    min: number;
    max: number;
    price: number;
  }>;

  // 3) Match robusto: se ci sono overlap, prendo la fascia col MIN più alto (la più specifica)
  const matches = bands.filter((b) => weightTotalGrams >= b.min && weightTotalGrams <= b.max);
  if (!matches.length) {
    throw new Error(`No shipping rate for zone=${zone} weight=${weightTotalGrams}g`);
  }

  matches.sort((a, b) => b.min - a.min);
  const band = matches[0];

  return {
    zone,
    weightTotalGrams,
    shippingEur: band.price,
  };
}