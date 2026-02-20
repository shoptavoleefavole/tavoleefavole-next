// src/lib/shipping.server.ts
type CartItem = { productId: number; qty: number };

type ShippingZone = "IT_MAINLAND" | "IT_ISLANDS";

const STRAPI_URL =
  process.env.STRAPI_URL ||
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  "http://localhost:1337";

const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;

function requireEnv(name: string, value: string | undefined) {
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function normalizeStrapiProductWeight(p: any): number {
  // compat: Strapi 4/5 can differ; we just read common patterns
  const w =
    p?.weight_grams ??
    p?.attributes?.weight_grams ??
    p?.data?.attributes?.weight_grams;

  const n = Number(w);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n);
}

async function fetchStrapi<T>(path: string): Promise<T> {
  const token = requireEnv("STRAPI_API_TOKEN", STRAPI_TOKEN);
  const res = await fetch(`${STRAPI_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    // cache: no-store perché prezzi spedizione non devono essere “vecchi”
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Strapi error ${res.status} on ${path}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function calculateShippingQuote(args: {
  items: CartItem[];
  zone: ShippingZone;
}) {
  const { items, zone } = args;

  if (!items?.length) {
    return { zone, weightTotalGrams: 0, shippingEur: 0 };
  }

  // 1) Rileggo da Strapi i pesi (non mi fido del client)
  // Costruisco una query per prendere solo i prodotti necessari
  const ids = Array.from(new Set(items.map((i) => i.productId)));
  const filters = ids.map((id) => `filters[id][$in]=${id}`).join("&");

  // Strapi response shape can differ. We'll handle both loosely.
  const productsResp: any = await fetchStrapi<any>(`/api/products?${filters}&pagination[pageSize]=100`);

  const list: any[] = Array.isArray(productsResp?.data) ? productsResp.data : [];
  const byId = new Map<number, any>();
  for (const p of list) {
    const id = Number(p?.id ?? p?.data?.id);
    if (Number.isFinite(id)) byId.set(id, p?.attributes ?? p);
  }

  let weightTotalGrams = 0;
  const missing: number[] = [];

  for (const it of items) {
    const p = byId.get(it.productId);
    const w = normalizeStrapiProductWeight(p);
    if (!w) missing.push(it.productId);
    weightTotalGrams += w * it.qty;
  }

  if (missing.length) {
    throw new Error(
      `Missing weight_grams for productId(s): ${missing.join(", ")}`
    );
  }

  // 2) Prendo tutte le fasce per la zona scelta
  const ratesResp: any = await fetchStrapi<any>(
    `/api/shipping-rates?filters[zone][$eq]=${zone}&filters[active][$eq]=true&pagination[pageSize]=200`
  );
  const rates: any[] = Array.isArray(ratesResp?.data) ? ratesResp.data : [];

  // Normalizzo
  const bands = rates
    .map((r) => r?.attributes ?? r)
    .map((r) => ({
      min: Number(r.min_weight_grams),
      max: Number(r.max_weight_grams),
      price: Number(r.price_eur),
    }))
    .filter((b) => Number.isFinite(b.min) && Number.isFinite(b.max) && Number.isFinite(b.price));

  // 3) Trovo la banda giusta
  const band = bands.find((b) => weightTotalGrams >= b.min && weightTotalGrams <= b.max);

  if (!band) {
    throw new Error(
      `No shipping rate for zone=${zone} weight=${weightTotalGrams}g`
    );
  }

  return {
    zone,
    weightTotalGrams,
    shippingEur: band.price,
  };
}