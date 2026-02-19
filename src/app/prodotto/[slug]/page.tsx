import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import AddToCartButton from "@/components/cart/AddToCartButton";
// ✅ lasciamo import per debug, ma non è più source of truth
import { getAvailability } from "@/lib/inventory.server";
import FavoriteToggleButton from "@/components/favorites/FavoriteToggleButton";

import {
  getProductById,
  getProductBySlug,
  getRelatedProducts,
  getMacroBySlug,
  getSubBySlug,
} from "@/lib/catalog";

import ProductGallery from "@/components/product/ProductGallery";
import ProductTabs from "@/components/product/ProductTabs";
import Breadcrumbs from "@/components/Breadcrumbs";

const STRAPI_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  process.env.STRAPI_URL ||
  "http://localhost:1337";

type CategoryRef = { slug: string; label: string };

type ProductLike = {
  id?: string | number | null;
  documentId?: string | null;
  slug: string;
  name: string;
  price?: number | null;
  compareAtPrice?: number | null;
  shortDescription?: string | null;
  description?: any;
  specs?: any;
  inStock?: boolean;
  variants?: Array<{ sku?: string | null }>;
  variant?: { sku?: string | null } | null;
  image?: string | null;
  images?: any;
  category?: CategoryRef;
  subcategory?: CategoryRef;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoImage?: string | null;
  isNew?: boolean;

  // ✅ STOCK (Strapi source of truth)
  stockQty?: number | null;
  trackInventory?: boolean | null;
};

function safeDecode(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function absUrl(base: string, maybeUrl: string | null | undefined) {
  if (!maybeUrl) return "";
  const u = String(maybeUrl).trim();
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${base.replace(/\/$/, "")}${u}`;
  return u;
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

function getImages(product: ProductLike): string[] {
  if (Array.isArray((product as any)?.images) && (product as any).images.length) {
    const first = (product as any).images[0];
    if (typeof first === "string") return (product as any).images as string[];
    return extractMediaUrls(STRAPI_URL, (product as any).images);
  }

  const fromMedia = extractMediaUrls(STRAPI_URL, (product as any)?.images);
  if (fromMedia.length) return fromMedia;

  if (typeof product?.image === "string" && product.image) return [product.image];

  const fromImage = extractMediaUrls(STRAPI_URL, (product as any)?.image);
  if (fromImage.length) return fromImage;

  return [];
}

function clampText(s: unknown, max = 160): string {
  const str = String(s ?? "").trim().replace(/\s+/g, " ");
  if (!str) return "";
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

function richTextToPlainText(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (const block of value) {
      const children = block?.children;
      if (Array.isArray(children)) {
        for (const ch of children) {
          const t = ch?.text;
          if (typeof t === "string" && t.trim()) parts.push(t.trim());
        }
      }
    }
    return parts.join("\n\n").trim();
  }

  try {
    return String(value);
  } catch {
    return "";
  }
}

function toNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getDefaultSku(p: ProductLike): string | null {
  return p?.variants?.[0]?.sku ?? p?.variant?.sku ?? null;
}

// ✅ chiave robusta per preferiti (Strapi 5: documentId)
function favoriteKey(p: { documentId?: any; id?: any; slug?: any }) {
  return String(p?.documentId ?? p?.id ?? p?.slug ?? "").trim();
}

type StockStatus = "in" | "out" | "unknown";

function getStockStatus(trackInventory?: boolean | null, stockQty?: number | null): StockStatus {
  // trackInventory === false => sempre acquistabile
  if (trackInventory === false) return "in";

  const n = typeof stockQty === "number" && Number.isFinite(stockQty) ? stockQty : null;
  if (n === null) return "unknown"; // fallback permissivo
  return n > 0 ? "in" : "out";
}

function stockBadge(status: StockStatus) {
  if (status === "in") return { text: "Disponibile", cls: "border-border" };
  if (status === "out") return { text: "Esaurito", cls: "border-red-200 text-red-600" };
  return { text: "Disponibilità da verificare", cls: "border-border text-text/70" };
}

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const p = (await params) ?? ({} as any);
  const slug = safeDecode(p?.slug);

  if (!slug) {
    return {
      title: "Prodotto non trovato",
      description: "Il prodotto richiesto non è disponibile.",
    };
  }

  const prod =
    ((await getProductBySlug(slug)) as any as ProductLike | null) ??
    ((await getProductById(slug)) as any as ProductLike | null);

  if (!prod) {
    return {
      title: "Prodotto non trovato",
      description: "Il prodotto richiesto non è disponibile.",
    };
  }

  const images = getImages(prod);
  const desc = clampText(
    prod.seoDescription ??
      prod.shortDescription ??
      richTextToPlainText(prod.description) ??
      prod.name,
    170
  );

  return {
    title: prod.seoTitle ?? prod.name,
    description: desc,
    alternates: { canonical: `/prodotto/${prod.slug}` },
    openGraph: {
      title: prod.seoTitle ?? prod.name,
      description: desc,
      type: "website",
      url: `/prodotto/${prod.slug}`,
      images: images[0] ? [{ url: images[0] }] : undefined,
    },
  };
}

function TrustRow() {
  return (
    <div className="mt-4 grid gap-2">
      <div className="flex items-start gap-2 text-sm text-text/80">
        <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M6.5 10.2l2.1 2.2 5-5.6"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span>
          <b>Spedizione rapida</b> e imballo curato.
        </span>
      </div>

      <div className="flex items-start gap-2 text-sm text-text/80">
        <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M10 3.6a6.4 6.4 0 106.4 6.4"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
            />
            <path
              d="M10 6.2v4.1l2.8 1.7"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span>
          <b>Reso facile</b> se cambi idea.
        </span>
      </div>

      <div className="flex items-start gap-2 text-sm text-text/80">
        <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M10 2.5l6 2.6V10c0 4.4-3.1 7.3-6 8.4C7.1 17.3 4 14.4 4 10V5.1l6-2.6z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <path
              d="M7.4 10.1l1.7 1.8 3.6-4"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span>
          <b>Pagamenti sicuri</b> e assistenza dedicata.
        </span>
      </div>
    </div>
  );
}

export default async function ProductPage({
  params,
}: {
  params?: Promise<{ slug: string }>;
}) {
  const p = (await params) ?? ({} as any);
  const slug = safeDecode(p?.slug);
  if (!slug) return notFound();

  const bySlug = (await getProductBySlug(slug)) as any as ProductLike | null;

  if (!bySlug) {
    const byId = (await getProductById(slug)) as any as ProductLike | null;
    if (byId?.slug) redirect(`/prodotto/${byId.slug}`);
    return notFound();
  }

  const product = bySlug;
  const images = getImages(product);

  const favId = favoriteKey(product);

  // ✅ SOURCE OF TRUTH: Strapi stock fields
  const stockQty = typeof product?.stockQty === "number" && Number.isFinite(product.stockQty) ? product.stockQty : null;
  const trackInventory =
    typeof product?.trackInventory === "boolean" ? product.trackInventory : null;

  const status = getStockStatus(trackInventory, stockQty);
  const badge = stockBadge(status);

  // (Debug) Availability via inventory API - non decide lo stock, solo info in dev
  const defaultSku = getDefaultSku(product);
  const availability = defaultSku
    ? await getAvailability({ skus: [defaultSku], warehouse: "MAIN" })
    : null;

  const row = defaultSku ? (availability as any)?.data?.MAIN?.[defaultSku] ?? null : null;

  // Category/Subcategory
  const catSlug = product?.category?.slug ?? null;
  const subSlug = product?.subcategory?.slug ?? null;

  const macro = catSlug ? await getMacroBySlug(catSlug) : null;
  const sub = catSlug && subSlug ? await getSubBySlug(catSlug, subSlug) : null;

  const catLabel = product?.category?.label ?? macro?.label ?? catSlug ?? "";
  const subLabel = product?.subcategory?.label ?? sub?.label ?? subSlug ?? "";

  // Related
  const related = (await getRelatedProducts(product as any, 8)) as any[];

  const price = toNumber(product?.price) ?? 0;
  const compareAt = toNumber(product?.compareAtPrice);
  const hasSale = compareAt != null && compareAt > price && price > 0;

  const shortDesc = clampText(
    product.shortDescription ?? richTextToPlainText(product.description),
    170
  );

  const cartId = String(product?.documentId ?? product?.id ?? product?.slug);
  const cartImage = (images?.[0] ?? product?.image ?? null) || undefined;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:py-8">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Catalogo", href: "/catalogo" },
          ...(catSlug && catLabel ? [{ label: catLabel, href: `/categoria/${catSlug}` }] : []),
          ...(catSlug && subSlug && subLabel
            ? [{ label: subLabel, href: `/categoria/${catSlug}/${subSlug}` }]
            : []),
          { label: product.name },
        ]}
      />

      <div className="mt-5 grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="relative">
            <ProductGallery images={images} alt={product.name} />

            {favId ? (
              <div className="absolute bottom-3 right-3 z-30 rounded-full bg-white/90 p-2 shadow">
                <FavoriteToggleButton productId={favId} />
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {product.isNew ? (
              <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold">
                Novità
              </span>
            ) : null}

            {hasSale ? (
              <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold">
                Offerta
              </span>
            ) : null}

            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badge.cls}`}>
              {badge.text}
            </span>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-28">
            <h1 className="text-3xl font-extrabold leading-tight">{product.name}</h1>

            {shortDesc ? (
              <p className="mt-3 text-sm text-text/70 md:text-base">{shortDesc}</p>
            ) : null}

            <div className="mt-4 flex items-baseline gap-3">
              {price > 0 ? (
                <div className="text-3xl font-extrabold">€ {price.toFixed(2)}</div>
              ) : (
                <div className="text-lg font-extrabold text-text/60">Prezzo non disponibile</div>
              )}

              {hasSale ? (
                <div className="text-sm text-text/60 line-through">€ {compareAt!.toFixed(2)}</div>
              ) : null}
            </div>

            <div className="mt-3 text-sm text-text/70">
              Codice:{" "}
              <span className="text-text">
                {String(product.id ?? product.documentId ?? "—")}
              </span>
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-background px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-extrabold">Disponibilità</div>
                <div className="text-sm font-semibold">
                  {status === "in" ? (
                    <span className="text-text">Disponibile</span>
                  ) : status === "out" ? (
                    <span className="text-red-600">Esaurito</span>
                  ) : (
                    <span className="text-text/70">Da verificare</span>
                  )}
                </div>
              </div>

              <p className="mt-2 text-sm text-text/70">
                {status === "in"
                  ? "Spedizione veloce: prepariamo l’ordine appena confermato."
                  : status === "out"
                    ? "Puoi comunque salvare il prodotto e tornare più tardi."
                    : "La disponibilità verrà confermata durante l’ordine."}
              </p>

              {process.env.NODE_ENV !== "production" ? (
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-text/60">
                  <span className="rounded-full border border-border px-3 py-1">
                    trackInventory:{" "}
                    <b className="text-text">{String(trackInventory ?? "null")}</b>
                  </span>
                  <span className="rounded-full border border-border px-3 py-1">
                    stockQty: <b className="text-text">{String(stockQty ?? "null")}</b>
                  </span>
                  <span className="rounded-full border border-border px-3 py-1">
                    SKU: <b className="text-text">{defaultSku ?? "—"}</b>
                  </span>
                  {row ? (
                    <>
                      <span className="rounded-full border border-border px-3 py-1">
                        Available: <b className="text-text">{row.available}</b>
                      </span>
                      <span className="rounded-full border border-border px-3 py-1">
                        On hand: <b className="text-text">{row.onHand}</b>
                      </span>
                      <span className="rounded-full border border-border px-3 py-1">
                        Reserved: <b className="text-text">{row.reserved}</b>
                      </span>
                    </>
                  ) : (
                    <span className="rounded-full border border-border px-3 py-1">Row: —</span>
                  )}
                </div>
              ) : null}
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-background p-4">
              <div className="text-sm font-extrabold">Acquisto</div>

              {price > 0 ? (
                <div className="mt-3">
                  <AddToCartButton
                    id={cartId}
                    slug={product.slug}
                    name={product.name}
                    image={cartImage}
                    price={price}
                    qty={1}
                    // ✅ stock da Strapi
                    stockQty={stockQty}
                    trackInventory={trackInventory ?? undefined}
                    // ✅ legacy fallback (se unknown -> true)
                    inStock={status !== "out"}
                    disabledLabel="Non disponibile"
                    // ✅ blocco solo se OUT. Unknown non blocca.
                    disabled={status === "out"}
                  />
                </div>
              ) : (
                <div className="mt-3">
                  <button
                    type="button"
                    disabled
                    className="h-11 w-full rounded-xl border border-border bg-surface px-4 text-sm font-extrabold text-text/50"
                  >
                    Non acquistabile
                  </button>
                  <div className="mt-2 text-xs text-text/60">
                    Controlla che il prodotto su Strapi abbia il campo <b>price</b> compilato.
                  </div>
                </div>
              )}

              {favId ? (
                <div className="mt-3 text-xs text-text/60">
                  Salva nei preferiti per ritrovarlo nell’area personale.
                </div>
              ) : null}
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
              <div className="text-sm font-extrabold">Acquisto senza pensieri</div>
              <TrustRow />
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <Link href="/supporto" className="font-semibold text-link hover:text-link-hover">
                  Hai bisogno di aiuto? Supporto clienti
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ProductTabs
        description={richTextToPlainText(product.description) || product.shortDescription || ""}
        specs={Array.isArray(product.specs) ? product.specs : null}
      />

      <section className="mt-12">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xl font-extrabold">Ti suggeriamo anche…</h2>

          {catSlug ? (
            <Link
              href={`/catalogo?categoria=${encodeURIComponent(catSlug)}`}
              className="text-sm font-semibold text-link hover:text-link-hover"
            >
              Vedi tutti
            </Link>
          ) : (
            <Link href="/catalogo" className="text-sm font-semibold text-link hover:text-link-hover">
              Vedi catalogo
            </Link>
          )}
        </div>

        <div className="mt-4 flex gap-4 overflow-x-auto pb-2 no-scrollbar">
          {related.map((pRel: any) => {
            const pSlug = String(pRel?.slug ?? "").trim();
            if (!pSlug) return null;

            const pPrice = toNumber(pRel?.price) ?? 0;
            const pCompare = toNumber(pRel?.compareAtPrice);

            const relFavId = favoriteKey({
              documentId: pRel?.documentId,
              id: pRel?.id,
              slug: pSlug,
            });

            return (
              <div
                key={String(pRel?.documentId ?? pRel?.id ?? pSlug)}
                className="relative w-56 shrink-0 rounded-2xl border border-border bg-background hover:shadow-sm"
              >
                <Link href={`/prodotto/${pSlug}`} className="block p-3">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-surface-2/60">
                    {pRel?.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={String(pRel.image)}
                        alt={String(pRel.name ?? "")}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : null}

                    {relFavId ? (
                      <div className="absolute bottom-2 right-2 z-20 rounded-full bg-white/90 p-2 shadow">
                        <FavoriteToggleButton productId={relFavId} />
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3">
                    <div className="text-sm font-semibold line-clamp-2">{pRel.name}</div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-sm font-bold">
                        {pPrice > 0 ? `€ ${pPrice.toFixed(2)}` : "—"}
                      </span>
                      {pCompare && pCompare > pPrice && pPrice > 0 ? (
                        <span className="text-xs line-through text-text/50">
                          € {pCompare.toFixed(2)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
