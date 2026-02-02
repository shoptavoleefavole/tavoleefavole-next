import "server-only";

const STRAPI_URL_ENV = process.env.STRAPI_URL;
const INV_AVAILABILITY_SECRET_ENV = process.env.INV_AVAILABILITY_SECRET;

if (!STRAPI_URL_ENV) throw new Error("Missing STRAPI_URL in .env.local");
if (!INV_AVAILABILITY_SECRET_ENV) {
  throw new Error("Missing INV_AVAILABILITY_SECRET in .env.local");
}

// dopo i check: ora sono string sicure
const STRAPI_URL: string = STRAPI_URL_ENV;
const INV_AVAILABILITY_SECRET: string = INV_AVAILABILITY_SECRET_ENV;

export async function getAvailability(params: { skus: string[]; warehouse?: string }) {
  const url = new URL("/api/inv-availability", STRAPI_URL);
  url.searchParams.set("skus", params.skus.join(","));
  if (params.warehouse) url.searchParams.set("warehouse", params.warehouse);

  const res = await fetch(url.toString(), {
    headers: {
      "X-INV-SECRET": INV_AVAILABILITY_SECRET,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Strapi inv-availability failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<{
    data: Record<string, Record<string, { onHand: number; reserved: number; available: number }>>;
    meta?: any;
  }>;
}
