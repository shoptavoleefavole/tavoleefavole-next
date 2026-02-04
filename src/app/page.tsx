// src/app/page.tsx
import Link from "next/link";
import Image from "next/image";

import AddToCartButton from "@/components/cart/AddToCartButton";
import { getAvailability } from "@/lib/inventory.server";
import CialdeExamplesCarousel from "@/components/cialde/CialdeExamplesCarousel";
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
  id: string; // usato in cart ecc.
  strapiId: number | null; // ID numerico Strapi (relazioni Favorite)
  slug: string;
  name: string;
  price: number;
  compareAtPrice?: number | null;
  image?: string; // string | undefined
  images: string[];
  shortDescription?: string;
  sku?: string | null;
  inStock?: boolean;
};

const WHATSAPP_NUMBER = "393482483901";
function waUrl(text: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

/* ---------------- Strapi env ---------------- */

const STRAPI_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  process.env.STRAPI_URL ||
  "http://localhost:1337";

const STRAPI_TOKEN =
  process.env.STRAPI_API_TOKEN ||
  process.env.STRAPI_TOKEN ||
  process.env.NEXT_PUBLIC_STRAPI_API_TOKEN ||
  process.env.NEXT_PUBLIC_STRAPI_TOKEN ||
  "";

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

function toNumber(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

/* ---------------- ✅ Fetch robusto (NO crash) ---------------- */

// Timeout “nostro”: evita blocchi di 5 minuti quando Render è in cold start
async function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const timeoutMs = init.timeoutMs ?? 12_000; // 12s default
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

type FetchStrapiResult =
  | { ok: true; status: number; json: any }
  | { ok: false; status: number; json: null; text?: string };

async function fetchStrapi(pathOrUrl: string, revalidate = 60): Promise<FetchStrapiResult> {
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

  // helper “safe read”
  const readJsonSafe = async (res: Response) => {
    const text = await res.text().catch(() => "");
    const parsed = text ? safeJsonParse(text) : null;
    return { text, parsed };
  };

  try {
    // 1) tenta con token (se presente)
    if (STRAPI_TOKEN) {
      const res = await fetchWithTimeout(fullUrl, {
        timeoutMs: 15_000, // un filo più alto per Render
        headers: makeHeaders(true),
        next: { revalidate },
      });

      if (res.ok) {
        const json = await res.json().catch(() => null);
        return { ok: true, status: res.status, json };
      }

      // se non è 401/403 → errore “soft”, non blocca la home
      if (res.status !== 401 && res.status !== 403) {
        const { text } = await readJsonSafe(res);
        return { ok: false, status: res.status, json: null, text: text.slice(0, 1200) };
      }
      // se 401/403: fallback senza token
    }

    // 2) fallback public
    const res2 = await fetchWithTimeout(fullUrl, {
      timeoutMs: 15_000,
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
    // 🔥 IMPORTANTISSIMO: MAI throw → mai crash UI
    const isAbort = e?.name === "AbortError";
    return {
      ok: false,
      status: isAbort ? 504 : 500,
      json: null,
      text: isAbort ? "Timeout Strapi (cold start o rete lenta)" : String(e?.message || "fetch failed"),
    };
  }
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
    a?.iconUrl ??
    null;

  const icon = absUrl(baseStrapiUrl(), iconRaw);

  const subsData = a?.subcategories?.data ?? a?.subcategories ?? [];
  const subCount = Array.isArray(subsData) ? subsData.length : 0;

  return { slug, label, icon, subCount };
}

async function fetchHomeCategories(): Promise<HomeCat[]> {
  const qs = new URLSearchParams();
  qs.set("fields[0]", "label");
  qs.set("fields[1]", "slug");
  qs.set("populate[icon][fields][0]", "url");
  qs.set("populate[subcategories][fields][0]", "label");
  qs.set("populate[subcategories][fields][1]", "slug");
  qs.set("pagination[pageSize]", "100");
  qs.set("sort[0]", "createdAt:asc");

  const r = await fetchStrapi(`/api/categories?${qs.toString()}`, 60);
  if (!r.ok) return [];

  const data: any[] = Array.isArray(r.json?.data) ? r.json.data : [];
  return data.map(normalizeCategory).filter(Boolean) as HomeCat[];
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
  const imgs =
    extractMediaUrls(base, a?.images).length > 0
      ? extractMediaUrls(base, a?.images)
      : extractMediaUrls(base, a?.image).length > 0
      ? extractMediaUrls(base, a?.image)
      : extractMediaUrls(base, a?.cover).length > 0
      ? extractMediaUrls(base, a?.cover)
      : extractMediaUrls(base, a?.thumbnail);

  const image = imgs[0] ?? undefined;
  const id = String(row?.documentId ?? row?.id ?? a?.documentId ?? a?.id ?? slug);
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

  const r = await fetchStrapi(`/api/products?${qs.toString()}`, 60);
  if (!r.ok) return [];

  const data: any[] = Array.isArray(r.json?.data) ? r.json.data : [];
  return data.map(normalizeStrapiProduct).filter(Boolean) as HomeProduct[];
}

async function fetchSaleCandidates(limit = 24): Promise<HomeProduct[]> {
  const qs = new URLSearchParams();
  qs.set("populate[images]", "*");
  qs.set("sort[0]", "updatedAt:desc");
  qs.set("pagination[pageSize]", String(limit));
  qs.set("filters[compareAtPrice][$notNull]", "true");

  const r = await fetchStrapi(`/api/products?${qs.toString()}`, 60);
  if (!r.ok) return [];

  const data: any[] = Array.isArray(r.json?.data) ? r.json.data : [];
  return data.map(normalizeStrapiProduct).filter(Boolean) as HomeProduct[];
}

async function withAvailability(items: HomeProduct[]) {
  const skus = Array.from(
    new Set(items.map((p) => p.sku).filter((x): x is string => typeof x === "string" && x.length > 0))
  );

  if (!skus.length) return items;

  const availability = await getAvailability({ skus, warehouse: "MAIN" }).catch(() => null);
  const bySku = (availability as any)?.data?.MAIN ?? {};

  return items.map((p) => {
    if (!p.sku) return p;
    const row = bySku?.[p.sku] ?? null;
    const available = Number(row?.available ?? 0);
    return { ...p, inStock: available > 0 };
  });
}

/* ---------------- UI ---------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-surface">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-surface-2/70 blur-3xl" />
        <div className="absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-surface-2/70 blur-3xl" />
      </div>

      <div className="relative grid items-center gap-10 px-6 py-10 sm:px-10 sm:py-12 lg:grid-cols-12 lg:gap-8 lg:px-12">
        <div className="lg:col-span-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-extrabold text-text/70">
            Spedizione rapida • Supporto dedicato • Pagamenti sicuri
          </p>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            Ingredienti e accessori per pasticceria, confetti e cake design.
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-6 text-text/70 sm:text-base">
            Selezioniamo prodotti affidabili e facili da usare, con navigazione chiara e schede complete:
            un’esperienza semplice, come ti aspetti da un e-commerce serio.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/catalogo"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover"
            >
              Vai al catalogo
            </Link>

            <Link
              href="/spedizioni"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background px-5 text-sm font-extrabold hover:bg-surface-2"
            >
              Spedizioni & tempi
            </Link>

            <Link
              href="/resi"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background px-5 text-sm font-extrabold hover:bg-surface-2"
            >
              Resi & rimborsi
            </Link>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { t: "Pagamenti sicuri", d: "Carte · Stripe" },
              { t: "Resi", d: "Procedura semplice" },
              { t: "Assistenza", d: "Contatti chiari" },
            ].map((x) => (
              <div key={x.t} className="rounded-2xl border border-border bg-background/70 p-4">
                <div className="text-sm font-extrabold">{x.t}</div>
                <div className="mt-1 text-sm text-text/70">{x.d}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-background">
            <div className="relative aspect-[16/11]">
              <Image
                src="https://images.unsplash.com/photo-1542826438-bd32f43c5f65?auto=format&fit=crop&w=1600&q=70"
                alt="Preparazioni di pasticceria"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
                unoptimized
                priority
              />
            </div>

            <div className="grid gap-2 p-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="text-xs font-extrabold text-text/70">In evidenza</div>
                <div className="mt-1 text-sm font-extrabold">Novità e offerte sempre aggiornate</div>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="text-xs font-extrabold text-text/70">Affidabilità</div>
                <div className="mt-1 text-sm font-extrabold">Navigazione chiara e checkout semplice</div>
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-text/60">Immagine demo (puoi sostituirla con un banner tuo quando vuoi).</p>
        </div>
      </div>
    </section>
  );
}

function CategoryGrid({ categories }: { categories: HomeCat[] }) {
  return (
    <section className="mt-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Esplora per categoria</h2>
          <p className="mt-1 text-sm text-text/70">Seleziona una macroarea e trova subito i prodotti.</p>
        </div>

        <Link href="/catalogo" className="text-sm font-semibold text-link hover:text-link-hover">
          Vedi tutto
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

            <span className="ml-auto text-text/40 group-hover:text-text/60">→</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ProductRail(props: {
  title: string;
  subtitle?: string;
  rightHref: string;
  rightLabel: string;
  items: HomeProduct[];
}) {
  const { title, subtitle, rightHref, rightLabel, items } = props;

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
            const hasSale =
              p.compareAtPrice != null && Number(p.compareAtPrice) > Number(p.price) && p.price > 0;

            const canBuy = (p.inStock ?? true) && p.price > 0;

            const favoriteProductId = p.strapiId ?? (Number.isFinite(Number(p.id)) ? Number(p.id) : p.id);

            return (
              <div
                key={p.id}
                className="relative w-[260px] shrink-0 rounded-2xl border border-border bg-background p-4 hover:shadow-sm transition"
              >
                <FavoriteToggleButton productId={favoriteProductId} className="absolute right-3 top-3 z-10" />

                <Link href={`/prodotto/${p.slug}`} className="block">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-surface-2/60">
                    {p.image ? (
                      <Image src={p.image} alt={p.name} fill sizes="260px" className="object-cover" unoptimized />
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

                    {p.shortDescription ? (
                      <div className="mt-2 line-clamp-2 text-xs text-text/70">{p.shortDescription}</div>
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
                      price={p.price}
                      qty={1}
                      inStock={p.inStock ?? true}
                      disabledLabel="Esaurito"
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
            <h2 className="text-2xl font-extrabold tracking-tight">Un acquisto semplice, senza sorprese</h2>
            <p className="mt-1 text-sm text-text/70">Informazioni chiare su spedizioni, resi e assistenza.</p>
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
              <div className="mt-4 text-sm font-extrabold text-link group-hover:text-link-hover">{x.cta} →</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

const CIALDE_PAGE_HREF = "/cialde-personalizzate";

function PersonalizedWaferHero() {
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
              Personalizzazione rapida
            </p>

            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Cialde personalizzate per la tua torta
            </h2>

            <p className="mt-3 max-w-xl text-sm leading-6 text-text/70 sm:text-base">
              Carica un’immagine, scrivi una dedica e completa l’ordine in pochi minuti.
            </p>

            <div className="mt-6">
              <div className="text-sm font-extrabold">Come funziona</div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {[
                  { n: "1", t: "Scegli formato" },
                  { n: "2", t: "Scrivi la dedica" },
                  { n: "3", t: "Carica l’immagine" },
                ].map((x) => (
                  <div key={x.n} className="rounded-2xl border border-border bg-surface p-4">
                    <div className="text-xs font-extrabold text-text/70">Step {x.n}</div>
                    <div className="mt-1 text-sm font-extrabold">{x.t}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href={CIALDE_PAGE_HREF}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover"
              >
                Personalizza ora
              </Link>

              <a
                href={waUrl("Ciao! Vorrei info sulle cialde personalizzate 😊")}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-link hover:text-link-hover"
              >
                Hai dubbi? WhatsApp →
              </a>
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
  // ✅ anche se Strapi è down/lento, NON deve crashare nulla
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
    <main className="mx-auto max-w-7xl px-4 py-10">
      <Hero />

      <PersonalizedWaferHero />

      <CategoryGrid categories={categories} />

      {saleWithStock.length > 0 ? (
        <ProductRail
          title="In offerta"
          subtitle="Occasioni da non perdere: sconti selezionati."
          rightHref="/catalogo"
          rightLabel="Vedi catalogo"
          items={saleWithStock}
        />
      ) : null}

      {latest.length > 0 ? (
        <ProductRail
          title="Novità"
          subtitle="Ultimi arrivi: nuovi prodotti disponibili."
          rightHref="/catalogo"
          rightLabel="Vedi catalogo"
          items={latest}
        />
      ) : null}

      <InfoCards />

      <section className="mt-12">
        <div className="rounded-3xl border border-border bg-background p-6 sm:p-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">Pronto a scegliere i tuoi prodotti?</h2>
              <p className="mt-1 text-sm text-text/70">Naviga il catalogo e trova subito ciò che ti serve.</p>
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
