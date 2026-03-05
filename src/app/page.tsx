// src/app/page.tsx

import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";

import AddToCartButton from "@/components/cart/AddToCartButton";
import { getAvailability } from "@/lib/inventory.server";
import FavoriteToggleButton from "@/components/favorites/FavoriteToggleButton";
import CialdeExamplesCarousel from "@/components/cialde/CialdeExamplesCarousel";
import EasterHeroPromo from "@/components/seasonal/EasterHeroPromo";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type HomeProduct = {
  id: string;
  strapiId: number | null;
  slug: string;
  name: string;
  price: number;
  compareAtPrice?: number | null;
  priceAziende?: number | null; // ← AGGIUNTO
  image?: string;
  images: string[];
  shortDescription?: string;
  sku?: string | null;
  stockQty?: number | null;
  trackInventory?: boolean | null;
  inStock?: boolean;
};

type EasterProduct = {
  slug: string;
  name: string;
  imageUrl?: string | null;
  price?: number | null;
  compareAtPrice?: number | null;
};

/** ✅ QUI scegli i prodotti pasquali da mostrare nel riquadro HERO (solo questi scorrono) */
const EASTER_FEATURED_SLUGS = [
  "uovo-di-pasqua-caffarel-500g",
  "uovo-di-pasqua-lindt-400g",
  "ovetti-assortiti-200g",
  "coniglietto-cioccolato-150g",
];

/* ---------------- WhatsApp ---------------- */

const WHATSAPP_NUMBER = "393482783901";
function waUrl(text: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

/* ---------------- Strapi env ---------------- */

const STRAPI_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  process.env.STRAPI_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://tavoleefavole-strapi.onrender.com"
    : "http://localhost:1337");

const STRAPI_TOKEN =
  process.env.STRAPI_API_TOKEN ||
  process.env.STRAPI_TOKEN ||
  process.env.NEXT_PUBLIC_STRAPI_API_TOKEN ||
  process.env.NEXT_PUBLIC_STRAPI_TOKEN ||
  "";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://tavoleefavole-next-t7pd.vercel.app"
).replace(/\/+$/, "");

/* ---------------- Utils ---------------- */

function baseStrapiUrl() {
  return String(STRAPI_URL || "").replace(/\/+$/, "");
}

function absUrl(base: string, maybeUrl: string | null | undefined) {
  if (!maybeUrl) return null;
  const u = String(maybeUrl).trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${base.replace(/\/$/, "")}${u}`;
  return `${base.replace(/\/$/, "")}/${u.replace(/^\/+/, "")}`;
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

function toNumber(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toInt(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

function toBool(v: any): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function getDefaultSku(item: any): string | null {
  return item?.variants?.[0]?.sku ?? item?.variant?.sku ?? null;
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

/* ---------------- Deadline helper ---------------- */

function withDeadline<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), ms);
    }),
  ]);
}

/* ---------------- Fetch robusto ---------------- */

async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
) {
  const timeoutMs = init.timeoutMs ?? 10000;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  const hasRevalidate = Boolean((init as any)?.next?.revalidate);
  const hasExplicitCache = typeof (init as any)?.cache === "string";

  const mergedInit: RequestInit = {
    ...init,
    signal: controller.signal,
    ...(hasExplicitCache || hasRevalidate ? {} : { cache: "no-store" }),
  };

  try {
    return await fetch(url, mergedInit);
  } finally {
    clearTimeout(t);
  }
}

type FetchStrapiResult =
  | { ok: true; status: number; json: any }
  | { ok: false; status: number; json: null; text?: string };

async function fetchStrapi(
  pathOrUrl: string,
  opts: { revalidate?: number; timeoutMs?: number } = {}
): Promise<FetchStrapiResult> {
  const { revalidate = 60, timeoutMs = 10000 } = opts;
  const base = baseStrapiUrl();

  const fullUrl =
    /^https?:\/\//i.test(pathOrUrl)
      ? pathOrUrl
      : `${base}${String(pathOrUrl).startsWith("/") ? "" : "/"}${pathOrUrl}`;

  const makeHeaders = (withAuth: boolean) => {
    const h: Record<string, string> = { Accept: "application/json" };
    if (withAuth && STRAPI_TOKEN) h.Authorization = `Bearer ${STRAPI_TOKEN}`;
    return h;
  };

  const readJsonSafe = async (res: Response) => {
    const text = await res.text().catch(() => "");
    const parsed = text ? safeJsonParse(text) : null;
    return { text, parsed };
  };

  try {
    if (STRAPI_TOKEN) {
      const res = await fetchWithTimeout(fullUrl, {
        timeoutMs,
        headers: makeHeaders(true),
        next: { revalidate },
      });

      if (res.ok) {
        const json = await res.json().catch(() => null);
        return { ok: true, status: res.status, json };
      }

      if (res.status !== 401 && res.status !== 403) {
        const { text } = await readJsonSafe(res);
        return { ok: false, status: res.status, json: null, text: text.slice(0, 1200) };
      }
    }

    const res2 = await fetchWithTimeout(fullUrl, {
      timeoutMs,
      headers: makeHeaders(false),
      next: { revalidate },
    });

    if (res2.ok) {
      const json = await res2.json().catch(() => null);
      return { ok: true, status: res2.status, json };
    }

    const { text } = await readJsonSafe(res2);
    return { ok: false, status: res2.status, json: null, text: text.slice(0, 1200) };
  } catch (e: any) {
    const isAbort = e?.name === "AbortError";
    return {
      ok: false,
      status: isAbort ? 504 : 500,
      json: null,
      text: isAbort
        ? "Timeout Strapi (cold start o rete lenta)"
        : String(e?.message || "fetch failed"),
    };
  }
}

/* ---------------- PRODUCTS (Home) ---------------- */

function normalizeStrapiProduct(row: any): HomeProduct | null {
  const a = row?.attributes ?? row ?? {};
  const slug = String(a?.slug ?? "").trim();
  if (!slug) return null;

  const name = safeLabel(a?.name ?? a?.title, slug);
  const price = toNumber(a?.price) ?? 0;
  const compareAtPrice = a?.compareAtPrice == null ? null : toNumber(a?.compareAtPrice);
  const strapiId = typeof row?.id === "number" ? row.id : toNumber(row?.id) ?? null;

  const base = baseStrapiUrl();
  const mediaCandidates = [a?.images, a?.image, a?.cover, a?.thumbnail];

  let imgs: string[] = [];
  for (const m of mediaCandidates) {
    const u = extractMediaUrls(base, m);
    if (u.length) {
      imgs = u;
      break;
    }
  }

  const image = imgs[0] ?? undefined;
  const id = String(row?.documentId ?? row?.id ?? a?.documentId ?? a?.id ?? slug);
  const sku = getDefaultSku(a);
  const stockQty = toInt(a?.stockQty);
  const trackInventory = toBool(a?.trackInventory);

  // priceAziende: incluso qui, filtrato server-side in Home() prima di passarlo alla UI
  const rawPriceAziende = a?.priceAziende ?? null;
  const priceAziende =
    rawPriceAziende !== null && Number.isFinite(Number(rawPriceAziende))
      ? Number(rawPriceAziende)
      : null;

  return {
    id,
    strapiId,
    slug,
    name,
    price,
    compareAtPrice,
    priceAziende,
    image,
    images: imgs,
    shortDescription: String(a?.shortDescription ?? "").trim() || undefined,
    sku,
    stockQty,
    trackInventory,
    inStock: typeof a?.inStock === "boolean" ? a.inStock : undefined,
  };
}

async function fetchLatestProducts(limit = 12): Promise<HomeProduct[]> {
  const qs = new URLSearchParams();
  qs.set("fields[0]", "slug");
  qs.set("fields[1]", "name");
  qs.set("fields[2]", "price");
  qs.set("fields[3]", "compareAtPrice");
  qs.set("fields[4]", "shortDescription");
  qs.set("fields[5]", "stockQty");
  qs.set("fields[6]", "trackInventory");
  qs.set("fields[7]", "priceAziende"); // ← AGGIUNTO
  qs.set("populate[images][fields][0]", "url");
  qs.set("populate[images][fields][1]", "formats");
  qs.set("sort[0]", "createdAt:desc");
  qs.set("pagination[pageSize]", String(limit));

  const r = await fetchStrapi(`/api/products?${qs.toString()}`, {
    revalidate: 60,
    timeoutMs: 9000,
  });
  if (!r.ok) return [];
  const data: any[] = Array.isArray(r.json?.data) ? r.json.data : [];
  return data.map(normalizeStrapiProduct).filter(Boolean) as HomeProduct[];
}

async function fetchSaleCandidates(limit = 24): Promise<HomeProduct[]> {
  const qs = new URLSearchParams();
  qs.set("fields[0]", "slug");
  qs.set("fields[1]", "name");
  qs.set("fields[2]", "price");
  qs.set("fields[3]", "compareAtPrice");
  qs.set("fields[4]", "shortDescription");
  qs.set("fields[5]", "stockQty");
  qs.set("fields[6]", "trackInventory");
  qs.set("fields[7]", "priceAziende"); // ← AGGIUNTO
  qs.set("populate[images][fields][0]", "url");
  qs.set("populate[images][fields][1]", "formats");
  qs.set("sort[0]", "updatedAt:desc");
  qs.set("pagination[pageSize]", String(limit));
  qs.set("filters[compareAtPrice][$notNull]", "true");

  const r = await fetchStrapi(`/api/products?${qs.toString()}`, {
    revalidate: 60,
    timeoutMs: 9000,
  });
  if (!r.ok) return [];
  const data: any[] = Array.isArray(r.json?.data) ? r.json.data : [];
  return data.map(normalizeStrapiProduct).filter(Boolean) as HomeProduct[];
}

async function withAvailability(items: HomeProduct[]) {
  const skus = Array.from(
    new Set(items.map((p) => p.sku).filter((x): x is string => !!x))
  );
  if (!skus.length) return items;

  const availability = await getAvailability({ skus, warehouse: "MAIN" }).catch(() => null);
  const bySku = (availability as any)?.data?.MAIN ?? {};

  return items.map((p) => {
    const track = p.trackInventory !== false;
    const hasQty = typeof p.stockQty === "number";
    if (track && hasQty) return p;

    if (!p.sku) return p;
    const row = bySku?.[p.sku] ?? null;
    const available = Number(row?.available ?? 0);
    return { ...p, inStock: available > 0 };
  });
}

async function withAvailabilitySafe(items: HomeProduct[], timeoutMs = 2500) {
  if (!items.length) return items;
  return withDeadline(withAvailability(items), timeoutMs, items);
}

/* ---------------- HERO PRODUCTS (Pasqua selezionati) ---------------- */

async function fetchEasterProducts(limit = 10): Promise<EasterProduct[]> {
  const base = baseStrapiUrl();
  const token =
    process.env.STRAPI_API_TOKEN ||
    process.env.STRAPI_TOKEN ||
    process.env.NEXT_PUBLIC_STRAPI_API_TOKEN ||
    process.env.NEXT_PUBLIC_STRAPI_TOKEN ||
    "";

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  async function get(url: string) {
    const res = await fetch(url, { headers, next: { revalidate: 60 } });
    if (!res.ok) return null;
    return (await res.json().catch(() => null)) as any;
  }

  const qs = new URLSearchParams();
  qs.set("fields[0]", "slug");
  qs.set("fields[1]", "name");
  qs.set("fields[2]", "price");
  qs.set("fields[3]", "compareAtPrice");
  qs.set("populate[images][fields][0]", "url");
  qs.set("populate[images][fields][1]", "formats");
  qs.set("pagination[pageSize]", "100");
  qs.set("filters[category][slug][$eq]", "pasqua");
  qs.set("sort[0]", "updatedAt:desc");

  const json = await get(`${base}/api/products?${qs.toString()}`);
  const rows: any[] = Array.isArray(json?.data) ? json.data : [];

  function pickImage(a: any) {
    const imgs = a?.images?.data ?? a?.images ?? [];
    const first = Array.isArray(imgs) ? imgs[0] : imgs;
    const raw =
      first?.attributes?.formats?.small?.url ??
      first?.attributes?.formats?.thumbnail?.url ??
      first?.attributes?.url ??
      first?.formats?.small?.url ??
      first?.formats?.thumbnail?.url ??
      first?.url ??
      null;

    if (!raw) return null;
    if (String(raw).startsWith("http")) return String(raw);
    if (String(raw).startsWith("/")) return `${base}${raw}`;
    return `${base}/${String(raw).replace(/^\/+/, "")}`;
  }

  const mapped = rows
    .map((r) => {
      const a = r?.attributes ?? r ?? {};
      const slug = String(a?.slug ?? "").trim();
      if (!slug) return null;

      return {
        slug,
        name: String(a?.name ?? a?.title ?? slug),
        imageUrl: pickImage(a),
        price: toNumber(a?.price),
        compareAtPrice: a?.compareAtPrice == null ? null : toNumber(a?.compareAtPrice),
      } as EasterProduct;
    })
    .filter(Boolean) as EasterProduct[];

  const selected = EASTER_FEATURED_SLUGS.map((s) => String(s).trim()).filter(Boolean);

  if (selected.length) {
    const bySlug = new Map(mapped.map((p) => [p.slug, p]));
    const picked = selected.map((s) => bySlug.get(s)).filter(Boolean) as EasterProduct[];
    return picked.length ? picked.slice(0, limit) : mapped.slice(0, limit);
  }

  return mapped.slice(0, limit);
}

/* ---------------- Business user check ---------------- */

async function checkIsBusiness(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const tf = cookieStore.get("tf_token")?.value ?? null;
    if (!tf) return false;

    // Validazione base: deve sembrare un JWT (3 parti base64)
    if (tf.split(".").length !== 3) return false;

    const res = await fetchWithTimeout(`${SITE_URL}/api/account/type`, {
      cache: "no-store",
      headers: { Cookie: cookieStore.toString() },
      timeoutMs: 8000,
    });
    if (!res.ok) return false;

    const json = await res.json().catch(() => null);
    const ct = String(json?.customerType ?? "").toUpperCase();
    return ct === "AZIENDE" || ct === "BUSINESS";
  } catch {
    return false;
  }
}

/* ---------------- UI ---------------- */

function ProductRail(props: {
  title: string;
  subtitle?: string;
  rightHref: string;
  rightLabel: string;
  items: HomeProduct[];
  isBusiness?: boolean; // ← AGGIUNTO
}) {
  const { title, subtitle, rightHref, rightLabel, items, isBusiness = false } = props;

  return (
    <section className="mt-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-text/70">{subtitle}</p> : null}
        </div>

        <Link href={rightHref} className="text-sm font-semibold text-link hover:text-link-hover">
          {rightLabel}
        </Link>
      </div>

      <div className="relative mt-6 -mx-4 px-4">
        <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2 scroll-smooth">
          {items.map((p) => {
            const effectivePrice =
              isBusiness && p.priceAziende && p.priceAziende > 0
                ? p.priceAziende
                : p.price;

            const hasSale =
              !isBusiness &&
              p.compareAtPrice != null &&
              Number(p.compareAtPrice) > Number(p.price) &&
              p.price > 0;

            const track = p.trackInventory !== false;
            const hasQty = typeof p.stockQty === "number";
            const isOutOfStock =
              track && hasQty ? p.stockQty! <= 0 : p.inStock === false;

            const canBuy = !isOutOfStock && effectivePrice > 0;

            const favoriteProductId =
              p.strapiId ?? (Number.isFinite(Number(p.id)) ? Number(p.id) : p.id);

            return (
              <div
                key={p.id}
                className="relative w-[260px] shrink-0 rounded-2xl border border-border bg-background p-4 hover:shadow-sm transition"
              >
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
                        sizes="(max-width: 768px) 100vw, 260px"
                        className="object-cover"
                        quality={60}
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

                    {/* ── Prezzo con supporto aziende ── */}
                    <div className="mt-2 flex flex-wrap items-baseline gap-2">
                      {isBusiness && p.priceAziende && p.priceAziende > 0 ? (
                        <>
                          <span className="text-sm font-extrabold text-primary">
                            € {p.priceAziende.toFixed(2)}
                          </span>
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary/80">
                            Azienda
                          </span>
                          {p.price > 0 ? (
                            <span className="text-xs line-through text-text/50">
                              € {p.price.toFixed(2)}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-extrabold">
                            {p.price > 0 ? `€ ${p.price.toFixed(2)}` : "Prezzo n.d."}
                          </span>
                          {hasSale ? (
                            <span className="text-xs line-through text-text/50">
                              € {Number(p.compareAtPrice).toFixed(2)}
                            </span>
                          ) : null}
                        </>
                      )}
                    </div>

                    {p.shortDescription ? (
                      <div className="mt-2 line-clamp-2 text-xs text-text/70">
                        {p.shortDescription}
                      </div>
                    ) : null}
                  </div>
                </Link>

                <div className="mt-4">
                  {canBuy ? (
                    <AddToCartButton
                      id={p.id}
                      slug={p.slug}
                      name={p.name}
                      image={p.image}
                      price={effectivePrice}
                      qty={1}
                      stockQty={p.stockQty ?? null}
                      trackInventory={
                        typeof p.trackInventory === "boolean" ? p.trackInventory : undefined
                      }
                      inStock={!isOutOfStock}
                      disabledLabel="Esaurito"
                    />
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="h-11 w-full rounded-xl border border-border bg-surface px-4 text-sm font-extrabold text-text/50"
                    >
                      {effectivePrice <= 0 ? "Non acquistabile" : "Esaurito"}
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

function InfoCards() {
  const cards = [
    { t: "Spedizioni", d: "Tempi chiari e tracking quando disponibile.", href: "/spedizioni", cta: "Vai a Spedizioni" },
    { t: "Resi & rimborsi", d: "Procedura semplice e assistenza dedicata.", href: "/resi", cta: "Leggi Resi" },
    { t: "Assistenza", d: "Email, telefono e WhatsApp.", href: "/contatti", cta: "Contattaci" },
    { t: "Privacy & Cookie", d: "Informazioni legali.", href: "/privacy-policy", cta: "Info legali" },
  ] as const;

  return (
    <section className="mt-12">
      <div className="rounded-3xl border border-border bg-surface p-6 sm:p-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">
              Un acquisto semplice, senza sorprese
            </h2>
            <p className="mt-1 text-sm text-text/70">
              Informazioni chiare su spedizioni, resi e assistenza.
            </p>
          </div>

          <Link
            href="/supporto"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background px-5 text-sm font-extrabold hover:bg-surface-2 sm:mt-0"
          >
            Vai al supporto
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((x) => (
            <Link
              key={x.t}
              href={x.href}
              className="group rounded-2xl border border-border bg-background p-5 hover:bg-surface-2 hover:shadow-sm transition"
            >
              <div className="text-sm font-extrabold">{x.t}</div>
              <div className="mt-2 text-sm text-text/70">{x.d}</div>
              <div className="mt-4 text-sm font-extrabold text-link group-hover:text-link-hover">
                {x.cta} →
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

const CIALDE_PAGE_HREF = "/cialde-personalizzate";
const BISCOTTI_PAGE_HREF = "/stampe-biscotti-personalizzate";

function PersonalizedPrintsCarouselBlock() {
  return (
    <section className="mt-10">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-background">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-surface-2/70 blur-3xl" />
          <div className="absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-surface-2/70 blur-3xl" />
        </div>

        <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-6">
            <p className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-xs font-extrabold text-text/70">
              Servizio Premium • Stampa alimentare
            </p>

            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Cialde personalizzate per torte
            </h2>

            <p className="mt-3 max-w-xl text-sm leading-6 text-text/70 sm:text-base">
              Carica la tua immagine, scrivi la dedica e ottieni una stampa perfetta per torte e
              biscotti, pronta da applicare.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href={CIALDE_PAGE_HREF}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-extrabold text-primary-contrast shadow-sm hover:bg-primary-hover"
              >
                Personalizza la tua cialda
              </Link>

              <Link
                href={BISCOTTI_PAGE_HREF}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background px-5 text-sm font-extrabold hover:bg-surface-2"
              >
                Stampe biscotti
              </Link>

              <a
                href={waUrl("Ciao! Vorrei info e un'anteprima per cialde/stampe personalizzate 😊")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background px-5 text-sm font-extrabold hover:bg-surface-2"
              >
                WhatsApp • info & anteprima
              </a>
            </div>

            {/* trust pills */}
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-semibold text-text/70">
              <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1">
                Qualità professionale
              </span>
              <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1">
                Supporto WhatsApp
              </span>
              <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1">
                Spedizione veloce
              </span>
            </div>
          </div>

          <div className="lg:col-span-6">
            <CialdeExamplesCarousel />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- PAGE ---------------- */

export default async function Home() {
  const latestP = withDeadline(fetchLatestProducts(12), 9500, []);
  const saleP = withDeadline(fetchSaleCandidates(24), 9500, []);
  const easterP = withDeadline(fetchEasterProducts(10), 9500, []);

  // checkIsBusiness in parallelo con i fetch prodotti — nessun overhead aggiuntivo
  const [latestRaw, saleCandRaw, easterProducts, isBusiness] = await Promise.all([
    latestP,
    saleP,
    easterP,
    checkIsBusiness(),
  ]);

  const sale = saleCandRaw
    .filter((p) => (p.compareAtPrice ?? 0) > p.price && p.price > 0)
    .slice(0, 12);

  const latestStockP = withDeadline(
    withAvailabilitySafe(latestRaw.slice(0, 12), 2500),
    2800,
    latestRaw.slice(0, 12)
  );
  const saleStockP = withDeadline(withAvailabilitySafe(sale, 2500), 2800, sale);

  const [latest, saleWithStock] = await Promise.all([latestStockP, saleStockP]);

  // SICUREZZA: se utente non è business, azzera priceAziende su tutti i prodotti
  const sanitize = (items: HomeProduct[]) =>
    items.map((p) => ({
      ...p,
      priceAziende: isBusiness ? (p.priceAziende ?? null) : null,
    }));

  const latestSanitized = sanitize(latest);
  const saleSanitized = sanitize(saleWithStock);

  return (
    <main className="mx-auto max-w-7xl px-4 pt-2 pb-10">
      <EasterHeroPromo products={easterProducts} />

      <PersonalizedPrintsCarouselBlock />

      {saleSanitized.length > 0 ? (
        <ProductRail
          title="In offerta"
          subtitle="Occasioni da non perdere: sconti selezionati."
          rightHref="/catalogo"
          rightLabel="Vedi catalogo"
          items={saleSanitized}
          isBusiness={isBusiness}
        />
      ) : null}

      {latestSanitized.length > 0 ? (
        <ProductRail
          title="Novità"
          subtitle="Ultimi arrivi: nuovi prodotti disponibili."
          rightHref="/catalogo"
          rightLabel="Vedi catalogo"
          items={latestSanitized}
          isBusiness={isBusiness}
        />
      ) : null}

      <InfoCards />

      <section className="mt-12">
        <div className="rounded-3xl border border-border bg-background p-6 sm:p-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">
                Pronto a scegliere i tuoi prodotti?
              </h2>
              <p className="mt-1 text-sm text-text/70">
                Naviga il catalogo e trova subito ciò che ti serve.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/catalogo"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover"
              >
                Vai al catalogo
              </Link>
              <Link
                href="/contatti"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background px-5 text-sm font-extrabold hover:bg-surface-2"
              >
                Contattaci
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
