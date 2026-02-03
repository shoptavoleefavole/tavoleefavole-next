// src/lib/occasions.server.ts
import { absStrapiUrl, strapiFetch } from "@/lib/strapi";

export type ActiveOccasion = {
  id: string;
  title: string;
  slug: string;
  heroTitle: string | null;
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD
  heroImageUrl: string | null;
  categorySlugs: string[];
};

type StrapiListResponse = {
  data?: unknown[];
  meta?: unknown;
};

// YYYY-MM-DD (per confronti lessicografici)
function toDateOnlyISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function pickString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

/**
 * Normalizza una riga "occasion" sia da Strapi v4 (data/attributes)
 * sia da eventuale shape flat (come hai visto in alcuni endpoint)
 */
function normalizeOccasion(row: any): ActiveOccasion {
  // v4: { id, attributes: {...} }
  // v5 / custom: { id, documentId, ...fields }
  const a = row?.attributes ?? row ?? {};

  const title =
    pickString(a?.Titolo) ??
    pickString(a?.title) ??
    pickString(a?.name) ??
    "";

  const slug = pickString(a?.slug) ?? pickString(a?.uid) ?? "";

  // media: heroImage può essere:
  // - { data: { attributes: { url } } }
  // - { data: [ ... ] }
  // - già un oggetto con url
  const heroData = a?.heroImage?.data ?? a?.heroImage ?? null;
  const heroItem = Array.isArray(heroData) ? heroData[0] : heroData;
  const heroUrlRaw =
    heroItem?.attributes?.url ??
    heroItem?.url ??
    heroItem?.data?.attributes?.url ??
    null;

  // categorie: può essere { data: [...] } oppure array diretto
  const catsData = a?.categories?.data ?? a?.categories ?? [];
  const catsArr = Array.isArray(catsData) ? catsData : [];
  const categorySlugs = catsArr
    .map((c: any) => pickString(c?.attributes?.slug) ?? pickString(c?.slug))
    .filter((s: string | null): s is string => Boolean(s));

  const id =
    pickString(row?.documentId) ??
    pickString(a?.documentId) ??
    (row?.id != null ? String(row.id) : "") ??
    "";

  return {
    id,
    title,
    slug,
    heroTitle: pickString(a?.heroTitle),
    startDate: pickString(a?.startDate),
    endDate: pickString(a?.endDate),
    heroImageUrl: absStrapiUrl(heroUrlRaw),
    categorySlugs,
  };
}

/**
 * Restituisce l’occasione attiva oggi (se esiste)
 */
export async function getActiveOccasion(): Promise<ActiveOccasion | null> {
  const today = toDateOnlyISO(new Date());

  const qs = new URLSearchParams();
  // populate robusto
  qs.set("populate[heroImage]", "*");
  qs.set("populate[categories]", "*");
  qs.set("pagination[pageSize]", "50");
  qs.set("sort[0]", "startDate:desc");

  // filtro isActive se esiste nel CT
  qs.set("filters[isActive][$eq]", "true");

  const json = await strapiFetch<StrapiListResponse>(
    `/api/occasions?${qs.toString()}`,
    { revalidate: 30 }
  );

  const rows = Array.isArray(json?.data) ? json!.data : [];
  const all = rows.map(normalizeOccasion);

  const activeToday = all.find((o: ActiveOccasion) => {
    const startOk = !o.startDate || o.startDate <= today;
    const endOk = !o.endDate || o.endDate >= today;
    // slug valido (evita record rotti)
    const hasSlug = o.slug.length > 0;
    return hasSlug && startOk && endOk;
  });

  return activeToday ?? null;
}
