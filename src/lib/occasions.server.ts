import "server-only";

export type Occasion = {
  id: number | string;
  documentId?: string | null;

  title: string;
  slug: string;

  heroTitle?: string | null;
  heroImageUrl?: string | null;

  startDate?: string | null; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
  isActive?: boolean;

  __raw?: any;
};

type StrapiOccasionRow = any;

const STRAPI_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  process.env.STRAPI_URL ||
  "http://localhost:1337";

const STRAPI_TOKEN =
  process.env.STRAPI_API_TOKEN || process.env.NEXT_PUBLIC_STRAPI_API_TOKEN;

function absUrl(base: string, maybeUrl?: string | null) {
  if (!maybeUrl) return null;
  const u = String(maybeUrl).trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${base.replace(/\/$/, "")}${u}`;
  return u;
}

/**
 * Oggi in formato YYYY-MM-DD, usando timeZone Europe/Rome
 * (evita problemi di giorno diverso per UTC).
 */
function todayISO(timeZone = "Europe/Rome") {
  const d = new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d); // => YYYY-MM-DD
}

function normalizeOccasion(row: StrapiOccasionRow): Occasion {
  // Strapi v4: { id, attributes: {...} }
  // Strapi v5: campi diretti + documentId
  const a = row?.attributes ?? row ?? {};

  const id = row?.documentId ?? row?.id ?? a?.documentId ?? a?.id ?? "";

  const title = a?.Titolo ?? a?.title ?? a?.name ?? a?.heroTitle ?? "";
  const slug = a?.slug ?? "";

  const heroImageData =
    a?.heroImage?.data ??
    a?.heroImage ??
    a?.image?.data ??
    a?.image ??
    null;

  const heroImageUrlRaw =
    heroImageData?.attributes?.url ?? heroImageData?.url ?? null;

  return {
    id,
    documentId: a?.documentId ?? row?.documentId ?? null,
    title: String(title || ""),
    slug: String(slug || ""),
    heroTitle: a?.heroTitle ?? null,
    heroImageUrl: absUrl(STRAPI_URL, heroImageUrlRaw),

    startDate: a?.startDate ?? null,
    endDate: a?.endDate ?? null,
    isActive: typeof a?.isActive === "boolean" ? a.isActive : undefined,

    __raw: a,
  };
}

function isWithinRange(today: string, start?: string | null, end?: string | null) {
  if (!start && !end) return true;
  if (start && today < start) return false;
  if (end && today > end) return false;
  return true;
}

/**
 * Ritorna solo le occasioni:
 * - isActive !== false
 * - oggi compreso tra startDate e endDate (se presenti)
 *
 * IMPORTANT: in questa fase deve essere "non bloccante":
 * se Strapi non risponde / endpoint manca -> ritorna []
 */
export async function getActiveOccasions(): Promise<Occasion[]> {
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (STRAPI_TOKEN) headers.Authorization = `Bearer ${STRAPI_TOKEN}`;

    const url = `${STRAPI_URL.replace(/\/$/, "")}/api/occasions?populate=*`;

    const res = await fetch(url, {
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      console.warn(
        `getActiveOccasions: Strapi /api/occasions failed (${res.status}): ${raw.slice(0, 200)}`
      );
      return [];
    }

    const json: any = await res.json();
    const data: any[] = Array.isArray(json?.data) ? json.data : [];

    const all: Occasion[] = data.map((row) => normalizeOccasion(row));
    const today = todayISO("Europe/Rome");

    return all
      .filter((o) => Boolean(o.slug) && Boolean(o.title))
      .filter((o) => o.isActive !== false)
      .filter((o) => isWithinRange(today, o.startDate, o.endDate));
  } catch (e) {
    console.warn("getActiveOccasions: failed (ignored):", e);
    return [];
  }
}
