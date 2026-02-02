// src/lib/occasions.server.ts
import { strapiFetch } from "@/lib/strapi";

export type ActiveOccasion = {
  id: string;
  title: string;
  slug: string;
  heroTitle: string | null;
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null;   // YYYY-MM-DD
  heroImageUrl: string | null;
  categorySlugs: string[];
};

type StrapiResponse = {
  data: any[];
  meta?: any;
};

function toDateOnlyISO(d: Date) {
  // YYYY-MM-DD (per filtri Strapi su date)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeOccasion(row: any): ActiveOccasion {
  const a = row?.attributes ?? row ?? {};

  const title = a?.Titolo ?? a?.title ?? a?.name ?? "";
  const slug = a?.slug ?? a?.uid ?? "";

  // heroImage: nel tuo CT era "heroImage" (media). Strapi può restituire data/attributes oppure url diretto.
  const heroData = a?.heroImage?.data ?? a?.heroImage ?? null;
  const hero0 = Array.isArray(heroData) ? heroData[0] : heroData;
  const heroUrlRaw = hero0?.attributes?.url ?? hero0?.url ?? null;

  // categories: relazione many-to-many. Raccogliamo gli slug (se disponibili)
  const catsData = a?.categories?.data ?? a?.categories ?? [];
  const categorySlugs = (Array.isArray(catsData) ? catsData : [])
    .map((c: any) => c?.attributes?.slug ?? c?.slug ?? null)
    .filter((s: any): s is string => typeof s === "string" && s.length > 0);

  return {
    id: String(row?.documentId ?? row?.id ?? a?.documentId ?? a?.id ?? ""),
    title,
    slug,
    heroTitle: a?.heroTitle ?? null,
    startDate: a?.startDate ?? null,
    endDate: a?.endDate ?? null,
    heroImageUrl: absStrapiUrl(heroUrlRaw),
    categorySlugs,
  };
}

export async function getActiveOccasion(): Promise<ActiveOccasion | null> {
  const today = toDateOnlyISO(new Date());

  const qs = new URLSearchParams();
  qs.set("populate[heroImage]", "*");
  qs.set("populate[categories]", "*");
  qs.set("pagination[pageSize]", "50"); // prendiamo un po' di record e filtriamo in JS (robusto)
  qs.set("sort[0]", "startDate:desc");

  // Filtri base (se i campi sono quelli che hai nello screenshot)
  qs.set("filters[isActive][$eq]", "true");

  const json = await strapiFetch<StrapiResponse>(`/api/occasions?${qs.toString()}`, {
    next: { revalidate: 30 },
  });

  const all = (json?.data ?? []).map(normalizeOccasion);

  // ✅ FIX del tuo errore "Parameter 'o' implicitly has any type":
  // qui tipizziamo esplicitamente "o: ActiveOccasion"
  const activeToday = all.find((o: ActiveOccasion) => {
    // se manca start/end: consideriamo valido (puoi cambiare regola)
    const startOk = !o.startDate || o.startDate <= today;
    const endOk = !o.endDate || o.endDate >= today;
    return startOk && endOk;
  });

  return activeToday ?? null;
}
export function absStrapiUrl(url?: string | null) {
  if (!url) return null;

  // se è già assoluto (https://...)
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  const base =
    process.env.NEXT_PUBLIC_STRAPI_URL ||
    process.env.STRAPI_URL ||
    "http://localhost:1337";

  // garantisce / tra base e path
  return `${base.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
}
