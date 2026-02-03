import Link from "next/link";
import Image from "next/image";
import AddToCartButton from "@/components/cart/AddToCartButton";
import { getAvailability } from "@/lib/inventory.server";

// ✅ preferiti (client) - 1 fetch per pagina
import FavoritesProvider from "@/components/favorites/FavoritesProvider";
import FavoriteToggleButton from "@/components/favorites/FavoriteToggleButton";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type HomeCat = {
  slug: string;
  label: string;
  icon?: string | null;
  subCount: number;
};

type HomeProduct = {
  id: string;                 // usato in cart ecc.
  strapiId: number | null;    // ✅ ID numerico Strapi (serve per relazioni Favorite)
  slug: string;
  name: string;
  price: number;
  compareAtPrice?: number | null;
  image?: string; // ✅ mai null: solo string | undefined
  images: string[];
  shortDescription?: string;
  sku?: string | null;
  inStock?: boolean;
};

const STRAPI_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  process.env.STRAPI_URL ||
  "http://localhost:1337";

const STRAPI_TOKEN =
  process.env.STRAPI_API_TOKEN || process.env.NEXT_PUBLIC_STRAPI_API_TOKEN;

function absUrl(base: string, maybeUrl: string | null | undefined) {
  if (!maybeUrl) return null;
  const u = String(maybeUrl).trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${base.replace(/\/$/, "")}${u}`;
  return u;
}

function safeLabel(v: unknown, fallback: string) {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractMediaUrls(base: string, media: any): string[] {
  if (!media) return [];
  const data = media?.data ?? media;
  const arr = Array.isArray(data) ? data : [data];

  return arr
    .map((node) => {
      const u =
        node?.attributes?.url ??
        node?.attributes?.formats?.large?.url ??
        node?.attributes?.formats?.medium?.url ??
        node?.attributes?.formats?.small?.url ??
        node?.attributes?.formats?.thumbnail?.url ??
        node?.url ??
        node?.formats?.large?.url ??
        node?.formats?.medium?.url ??
        node?.formats?.small?.url ??
        node?.formats?.thumbnail?.url ??
        null;

      return absUrl(base, u) || "";
    })
    .filter(Boolean);
}

function getDefaultSku(item: any): string | null {
  return item?.variants?.[0]?.sku ?? item?.variant?.sku ?? null;
}

function toNumber(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ---------------- CATEGORIES (Home) ---------------- */

function normalizeCategory(row: any): HomeCat | null {
  const a = row?.attributes ?? row ?? {};
  const slug = String(a?.slug ?? "").trim();
  if (!slug) return null;

  const label = safeLabel(a?.label ?? a?.name ?? a?.title, slug);

  const iconRaw =
    a?.icon?.url ??
    a?.icon?.data?.attributes?.url ??
    a?.icon?.attributes?.url ??
    a?.icon?.url ??
    a?.iconUrl ??
    null;

  const icon = absUrl(STRAPI_URL, iconRaw);

  const subsData = a?.subcategories?.data ?? a?.subcategories ?? [];
  const subCount = Array.isArray(subsData) ? subsData.length : 0;

  return { slug, label, icon, subCount };
}

async function fetchHomeCategories(): Promise<HomeCat[]> {
  const qs = new URLSearchParams();
  qs.set("populate[icon]", "*");
  qs.set("populate[subcategories]", "*");
  qs.set("pagination[pageSize]", "100");
  qs.set("sort[0]", "createdAt:asc");

  const url = `${STRAPI_URL.replace(/\/$/, "")}/api/categories?${qs.toString()}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (STRAPI_TOKEN) headers.Authorization = `Bearer ${STRAPI_TOKEN}`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 }, headers });
    if (!res.ok) return [];

    const json: any = await res.json().catch(() => null);
    const data: any[] = Array.isArray(json?.data) ? json.data : [];
    return data.map(normalizeCategory).filter(Boolean) as HomeCat[];
  } catch {
    return [];
  }
}

/* ---------------- PRODUCTS (Home) ---------------- */

function normalizeStrapiProduct(row: any): HomeProduct | null {
  const a = row?.attributes ?? row ?? {};
  const slug = String(a?.slug ?? "").trim();
  if (!slug) return null;

  const name = safeLabel(a?.name ?? a?.title, slug);

  const price = toNumber(a?.price) ?? 0;
  const compareAtPrice =
    a?.compareAtPrice == null ? null : toNumber(a?.compareAtPrice);

  // ✅ ID numerico vero di Strapi (serve per relazioni Favorite)
  const strapiId =
    typeof row?.id === "number" ? row.id : toNumber(row?.id) ?? null;

  const imgs =
    extractMediaUrls(STRAPI_URL, a?.images).length > 0
      ? extractMediaUrls(STRAPI_URL, a?.images)
      : extractMediaUrls(STRAPI_URL, a?.image).length > 0
      ? extractMediaUrls(STRAPI_URL, a?.image)
      : extractMediaUrls(STRAPI_URL, a?.cover).length > 0
      ? extractMediaUrls(STRAPI_URL, a?.cover)
      : extractMediaUrls(STRAPI_URL, a?.thumbnail);

  const image = imgs[0] ?? undefined; // ✅ undefined, non null

  const id = String(row?.documentId ?? row?.id ?? a?.documentId ?? a?.id ?? slug);

  // SKU
  const sku = getDefaultSku(a);

  return {
    id,
    strapiId,
    slug,
    name,
    price,
    compareAtPrice,
    image,
    images: imgs,
    shortDescription: String(a?.shortDescription ?? "").trim() || undefined,
    sku,
    inStock: typeof a?.inStock === "boolean" ? a.inStock : undefined,
  };
}

async function fetchLatestProducts(limit = 12): Promise<HomeProduct[]> {
  const qs = new URLSearchParams();
  qs.set("populate[images]", "*");
  qs.set("sort[0]", "createdAt:desc");
  qs.set("pagination[pageSize]", String(limit));

  const url = `${STRAPI_URL.replace(/\/$/, "")}/api/products?${qs.toString()}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (STRAPI_TOKEN) headers.Authorization = `Bearer ${STRAPI_TOKEN}`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 }, headers });
    const text = await res.text().catch(() => "");
    const json = safeJsonParse(text);
    if (!res.ok) return [];

    const data: any[] = Array.isArray(json?.data) ? json.data : [];
    return data.map(normalizeStrapiProduct).filter(Boolean) as HomeProduct[];
  } catch {
    return [];
  }
}

/**
 * Strapi non supporta (standard) compareAtPrice > price come filtro tra campi,
 * quindi: prendiamo prodotti con compareAtPrice valorizzato e filtriamo lato app.
 */
async function fetchSaleCandidates(limit = 24): Promise<HomeProduct[]> {
  const qs = new URLSearchParams();
  qs.set("populate[images]", "*");
  qs.set("sort[0]", "updatedAt:desc");
  qs.set("pagination[pageSize]", String(limit));
  qs.set("filters[compareAtPrice][$notNull]", "true");

  const url = `${STRAPI_URL.replace(/\/$/, "")}/api/products?${qs.toString()}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (STRAPI_TOKEN) headers.Authorization = `Bearer ${STRAPI_TOKEN}`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 }, headers });
    const text = await res.text().catch(() => "");
    const json = safeJsonParse(text);
    if (!res.ok) return [];

    const data: any[] = Array.isArray(json?.data) ? json.data : [];
    return data.map(normalizeStrapiProduct).filter(Boolean) as HomeProduct[];
  } catch {
    return [];
  }
}

async function withAvailability(items: HomeProduct[]) {
  const skus = Array.from(
    new Set(
      items
        .map((p) => p.sku)
        .filter((x): x is string => typeof x === "string" && x.length > 0)
    )
  );

  if (!skus.length) return items;

  const availability = await getAvailability({ skus, warehouse: "MAIN" }).catch(
    () => null
  );
  const bySku = (availability as any)?.data?.MAIN ?? {};

  return items.map((p) => {
    if (!p.sku) return p;
    const row = bySku?.[p.sku] ?? null;
    const available = Number(row?.available ?? 0);
    return { ...p, inStock: available > 0 };
  });
}

/* ---------------- UI helpers ---------------- */

function ProductRail(props: {
  title: string;
  rightHref: string;
  rightLabel: string;
  items: HomeProduct[];
}) {
  const { title, rightHref, rightLabel, items } = props;

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-xl font-extrabold">{title}</h2>
        <Link href={rightHref} className="text-sm font-semibold text-link hover:text-link-hover">
          {rightLabel}
        </Link>
      </div>

      <div className="relative mt-4 -mx-4 px-4">
        <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2 scroll-smooth">
          {items.map((p) => {
            const hasSale =
              p.compareAtPrice != null &&
              Number(p.compareAtPrice) > Number(p.price) &&
              p.price > 0;

            const canBuy = (p.inStock ?? true) && p.price > 0;

            // ✅ id da usare per preferiti: meglio numerico Strapi
            const favoriteProductId =
              p.strapiId ?? (Number.isFinite(Number(p.id)) ? Number(p.id) : p.id);

            return (
              <div
                key={p.id}
                className="relative w-[240px] shrink-0 rounded-2xl border border-border bg-background p-4 hover:shadow-sm transition"
              >
                {/* ❤️ preferiti (non dentro il Link, così non naviga al click) */}
                <FavoriteToggleButton
                  productId={favoriteProductId}
                  className="absolute right-3 top-3 z-10"
                />

                <Link href={`/prodotto/${p.slug}`} className="block">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-surface-2/60">
                    {p.image ? (
                      <Image
                        src={p.image}
                        alt={p.name}
                        fill
                        sizes="240px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : null}

                    {hasSale ? (
                      <span className="absolute left-2 top-2 rounded-full bg-accent px-3 py-1 text-[11px] font-extrabold text-accent-contrast">
                        Offerta
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3">
                    <div className="text-sm font-extrabold line-clamp-2">{p.name}</div>

                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-sm font-extrabold">
                        {p.price > 0 ? `€ ${p.price.toFixed(2)}` : "Prezzo n.d."}
                      </span>
                      {hasSale ? (
                        <span className="text-xs line-through text-text/50">
                          € {Number(p.compareAtPrice).toFixed(2)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>

                <div className="mt-3">
                  {canBuy ? (
                    <AddToCartButton
                      id={p.id}
                      slug={p.slug}
                      name={p.name}
                      image={p.image} // ✅ string | undefined
                      price={p.price}
                      qty={1}
                    />
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="h-11 w-full rounded-xl border border-border bg-surface px-4 text-sm font-extrabold text-text/50"
                    >
                      {p.price <= 0 ? "Non acquistabile" : "Esaurito"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background via-background/80 to-transparent" />
      </div>
    </section>
  );
}

/* ---------------- PAGE ---------------- */

export default async function Home() {
  const [catsRaw, latestRaw, saleCandRaw] = await Promise.all([
    fetchHomeCategories(),
    fetchLatestProducts(12),
    fetchSaleCandidates(24),
  ]);

  const categories =
    catsRaw.length > 0
      ? catsRaw.slice(0, 8)
      : [
          { slug: "prodotti-per-pasticceria", label: "Prodotti per pasticceria", icon: null, subCount: 0 },
          { slug: "decorazioni-per-dolci", label: "Decorazioni per dolci", icon: null, subCount: 0 },
          { slug: "confetti", label: "Confetti", icon: null, subCount: 0 },
        ];

  const sale = saleCandRaw
    .filter((p) => (p.compareAtPrice ?? 0) > p.price && p.price > 0)
    .slice(0, 12);

  const [latest, saleWithStock] = await Promise.all([
    withAvailability(latestRaw.slice(0, 12)),
    withAvailability(sale),
  ]);

  return (
    <FavoritesProvider>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <section className="rounded-3xl border border-border bg-surface p-6 sm:p-10">
          <h1 className="text-3xl font-extrabold">Tavole & Favole</h1>
          <p className="mt-2 max-w-2xl text-sm text-text/70">
            Tutto per pasticceria, confetti, decorazioni e specialità dolciarie.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/catalogo"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover"
            >
              Vai al catalogo
            </Link>

            <Link
              href="/supporto"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background px-5 text-sm font-extrabold hover:bg-surface-2"
            >
              Assistenza
            </Link>
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-xl font-extrabold">Esplora per categoria</h2>
            <Link href="/catalogo" className="text-sm font-semibold text-link hover:text-link-hover">
              Vedi tutto
            </Link>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/categoria/${c.slug}`}
                className="group rounded-2xl border border-border bg-background p-5 hover:bg-surface-2 hover:shadow-sm transition flex items-center gap-4"
              >
                <div className="shrink-0">
                  {c.icon ? (
                    <div className="grid h-12 w-12 place-items-center rounded-2xl border border-border bg-background">
                      <Image
                        src={c.icon}
                        alt=""
                        width={28}
                        height={28}
                        className="h-7 w-7"
                        unoptimized
                        aria-hidden="true"
                      />
                    </div>
                  ) : (
                    <div className="h-12 w-12 rounded-2xl border border-border bg-surface" aria-hidden="true" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="text-base font-extrabold leading-tight">{c.label}</div>
                  <div className="mt-1 text-sm text-text/70">
                    {c.subCount > 0 ? `${c.subCount} sottocategorie` : "Scopri i prodotti"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {saleWithStock.length > 0 ? (
          <ProductRail title="In offerta" rightHref="/catalogo" rightLabel="Vedi tutto" items={saleWithStock} />
        ) : null}

        {latest.length > 0 ? (
          <ProductRail title="Novità" rightHref="/catalogo" rightLabel="Vedi catalogo" items={latest} />
        ) : null}

        <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: "Spedizioni", d: "Gratuite sopra 79€" },
            { t: "Resi", d: "14 giorni" },
            { t: "Pagamenti", d: "Carte · PayPal · Bonifico" },
            { t: "Supporto", d: "Orari e contatti" },
          ].map((x) => (
            <div key={x.t} className="rounded-2xl border border-border bg-background p-5">
              <div className="text-sm font-extrabold">{x.t}</div>
              <div className="mt-1 text-sm text-text/70">{x.d}</div>
            </div>
          ))}
        </section>
      </main>
    </FavoritesProvider>
  );
}
