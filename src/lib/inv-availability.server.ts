import "server-only";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function getAvailability(params: { skus: string[]; warehouse: string }) {
  const STRAPI_URL = mustEnv("STRAPI_URL").replace(/\/$/, "");
  const INV_AVAILABILITY_SECRET = mustEnv("INV_AVAILABILITY_SECRET");

  const skus = params.skus.join(",");
  const url =
    `${STRAPI_URL}/api/inv-availability?skus=${encodeURIComponent(skus)}` +
    `&warehouse=${encodeURIComponent(params.warehouse)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "X-INV-SECRET": INV_AVAILABILITY_SECRET },
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Availability failed: ${res.status} ${res.statusText} | ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
