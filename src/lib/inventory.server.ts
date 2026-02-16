import "server-only";

type AvailabilityResponse = {
  data: Record<string, Record<string, { onHand: number; reserved: number; available: number }>>;
  meta?: any;
};

function strapiBaseUrl() {
  const raw =
    process.env.STRAPI_URL ||
    process.env.NEXT_PUBLIC_STRAPI_URL ||
    "http://localhost:1337";
  return String(raw).trim().replace(/\/+$/, "");
}

function isProd() {
  return process.env.NODE_ENV === "production";
}

/**
 * Fail-soft:
 * - NON lancia errori a import-time (build-safe)
 * - se mancano env, in dev/staging ritorna "unknown" senza bloccare
 * - in prod, se manca STRAPI_URL -> errore (misconfigurazione seria)
 * - in prod, se manca SECRET -> fail-soft (no stock check) MA non crasha
 */
export async function getAvailability(params: { skus: string[]; warehouse?: string }): Promise<AvailabilityResponse> {
  const base = strapiBaseUrl();
  const secret = process.env.INV_AVAILABILITY_SECRET;

  const skus = Array.isArray(params.skus) ? params.skus.map(s => String(s).trim()).filter(Boolean) : [];
  const warehouse = (params.warehouse ? String(params.warehouse).trim() : "") || "MAIN";

  // niente SKU => risposta vuota
  if (skus.length === 0) {
    return { data: { [warehouse]: {} } };
  }

  // STRAPI_URL mancante: in prod è un errore vero
  if (!base) {
    if (isProd()) throw new Error("Server misconfigured: missing STRAPI_URL");
    return { data: { [warehouse]: {} }, meta: { softFail: true, reason: "MISSING_STRAPI_URL" } };
  }

  // Secret mancante => fail-soft (non blocchiamo)
  if (!secret) {
    return { data: { [warehouse]: {} }, meta: { softFail: true, reason: "MISSING_INV_AVAILABILITY_SECRET" } };
  }

  const url = new URL("/api/inv-availability", base);
  url.searchParams.set("skus", skus.join(","));
  url.searchParams.set("warehouse", warehouse);

  const controller = new AbortController();
  const timeoutMs = Math.max(5000, Number(process.env.INV_AVAILABILITY_TIMEOUT_MS || 12000));
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url.toString(), {
      headers: { "X-INV-SECRET": secret },
      cache: "no-store",
      signal: controller.signal,
    });

    // se Strapi risponde male: in prod NON crashiamo il sito, ma “softFail”
    if (!res.ok) {
      if (!isProd()) {
        const text = await res.text().catch(() => "");
        console.warn("[inventory] Strapi inv-availability not ok:", res.status, text.slice(0, 200));
      }
      return { data: { [warehouse]: {} }, meta: { softFail: true, reason: `HTTP_${res.status}` } };
    }

    const json = (await res.json().catch(() => null)) as AvailabilityResponse | null;
    if (!json?.data) {
      return { data: { [warehouse]: {} }, meta: { softFail: true, reason: "BAD_JSON" } };
    }

    return json;
  } catch (e: any) {
    if (!isProd()) console.warn("[inventory] fetch failed:", e?.message || e);
    return { data: { [warehouse]: {} }, meta: { softFail: true, reason: "FETCH_FAILED" } };
  } finally {
    clearTimeout(t);
  }
}
