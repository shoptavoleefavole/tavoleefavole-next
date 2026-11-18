// src/app/prodotto/[slug]/page.tsx

export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";

import AddToCartButton from "@/components/cart/AddToCartButton";
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
import type { FoodInfoData, NutritionData } from "@/components/product/FoodComplianceSection";

const STRAPI_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  process.env.STRAPI_URL ||
  "https://tavoleefavole-strapi.onrender.com";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.tavoleefavole.com"
).replace(/\/+$/, "");

type CategoryRef = { slug: string; label: string };
type SpecRow = { label: string; value: string };

type ProductLike = {
  id?: string | number | null;
  documentId?: string | null;
  slug: string;
  name: string;
  price?: number | null;
  compareAtPrice?: number | null;
  priceAziende?: number | null;
  shortDescription?: string | null;
  description?: any;
  specs?: any;
  productDetails?: any;
  productDetail?: any;
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
  stockQty?: number | null;
  trackInventory?: boolean | null;
  visibleInStorefront?: boolean | null;
  brand?: string | null;
  sku?: string | null;
  gtin?: string | null;
  weight_grams?: number | null;
  foodInfo?: FoodInfoData | null;
  nutrition?: NutritionData | null;
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

function cloudinaryThumb(url: string, width = 400): string {
  if (!url || typeof url !== "string") return url;
  const m = url.match(/^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/);
  if (!m) return url;
  const [, base, rest] = m;
  if (/^[a-z_,]+[_,]/.test(rest)) return url;
  return `${base}f_auto,q_auto,w_${width},c_limit/${rest}`;
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

function richTextToPlainText(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value.trim();

  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (const block of value) {
      const blockText = richTextToPlainText(block);
      if (blockText) parts.push(blockText);
    }
    return parts.join("\n\n").trim();
  }

  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === "string" && obj.text.trim()) return obj.text.trim();

    const children: unknown[] | null = Array.isArray(obj.children)
      ? (obj.children as unknown[])
      : null;

    if (children?.length) {
      const parts = children
        .map((child: unknown) => richTextToPlainText(child))
        .filter((part: string) => Boolean(part));
      if (parts.length) return parts.join("").trim();
    }

    for (const key of ["value", "content", "description", "body"] as const) {
      const nested = obj[key];
      if (nested) {
        const nestedText = richTextToPlainText(nested);
        if (nestedText) return nestedText;
      }
    }
  }

  return "";
}

function prettifyLabel(raw: string): string {
  const cleaned = String(raw ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Dettaglio";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function splitTextToSpecs(text: string): SpecRow[] {
  const lines = String(text ?? "")
    .split(/\r?\n+/)
    .map((line) => line.replace(/^[\-•*]\s*/, "").trim())
    .filter(Boolean);

  const rows: SpecRow[] = [];
  for (const line of lines) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex > 0 && separatorIndex < line.length - 1) {
      const label = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      if (label && value) {
        rows.push({ label: prettifyLabel(label), value });
        continue;
      }
    }
    rows.push({
      label: rows.length === 0 ? "Dettagli prodotto" : `Dettaglio ${rows.length + 1}`,
      value: line,
    });
  }
  return rows;
}

function normalizeSpecs(value: any): SpecRow[] | null {
  if (!value) return null;

  if (Array.isArray(value)) {
    const normalized: SpecRow[] = [];
    for (const item of value) {
      if (!item) continue;
      if (typeof item === "string") {
        normalized.push(...splitTextToSpecs(item));
        continue;
      }
      const isRichTextBlock =
        typeof item === "object" &&
        item !== null &&
        typeof item.type === "string" &&
        Array.isArray(item.children);

      if (isRichTextBlock) {
        const fallbackText = richTextToPlainText(item);
        if (fallbackText) normalized.push(...splitTextToSpecs(fallbackText));
        continue;
      }

      if (typeof item === "object") {
        const labelCandidate = [item.label, item.name, item.title, item.key].find(
          (entry) => typeof entry === "string" && entry.trim()
        );
        const directValue = richTextToPlainText(
          item.value ?? item.text ?? item.description ?? item.content ?? item
        );
        if (labelCandidate && directValue) {
          normalized.push({ label: prettifyLabel(labelCandidate), value: directValue });
          continue;
        }
        const objectEntries = Object.entries(item)
          .filter(
            ([key, entry]) =>
              !["id", "__component", "createdAt", "updatedAt", "publishedAt"].includes(key) &&
              (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean")
          )
          .map(([key, entry]) => ({ label: prettifyLabel(key), value: String(entry).trim() }))
          .filter((row) => row.value);
        if (objectEntries.length) {
          normalized.push(...objectEntries);
          continue;
        }
        const fallbackText = richTextToPlainText(item);
        if (fallbackText) normalized.push(...splitTextToSpecs(fallbackText));
      }
    }
    return normalized.length ? normalized : null;
  }

  if (typeof value === "string") {
    const rows = splitTextToSpecs(value);
    return rows.length ? rows : null;
  }

  const isRichTextObject =
    typeof value === "object" &&
    value !== null &&
    typeof value.type === "string" &&
    Array.isArray(value.children);

  if (isRichTextObject) {
    const fallback = richTextToPlainText(value);
    if (!fallback) return null;
    const rows = splitTextToSpecs(fallback);
    return rows.length ? rows : null;
  }

  if (typeof value === "object") {
    const labeledValue = [value.label, value.name, value.title].find(
      (entry) => typeof entry === "string" && entry.trim()
    );
    const textValue = richTextToPlainText(
      value.value ?? value.text ?? value.description ?? value.content ?? value
    );
    if (labeledValue && textValue) {
      return [{ label: prettifyLabel(labeledValue), value: textValue }];
    }
    const objectEntries = Object.entries(value)
      .filter(
        ([key, entry]) =>
          !["id", "__component", "createdAt", "updatedAt", "publishedAt"].includes(key) &&
          (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean")
      )
      .map(([key, entry]) => ({ label: prettifyLabel(key), value: String(entry).trim() }))
      .filter((row) => row.value);
    if (objectEntries.length) return objectEntries;

    const fallback = richTextToPlainText(value);
    if (!fallback) return null;
    const rows = splitTextToSpecs(fallback);
    return rows.length ? rows : null;
  }

  return null;
}

function toNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getDefaultSku(p: ProductLike): string | null {
  return p?.sku?.trim() || p?.variants?.[0]?.sku || p?.variant?.sku || null;
}

function favoriteKey(p: { documentId?: any; id?: any; slug?: any }) {
  return String(p?.documentId ?? p?.id ?? p?.slug ?? "").trim();
}

type StockStatus = "in" | "out" | "unknown";

function getStockStatus(trackInventory?: boolean | null, stockQty?: number | null): StockStatus {
  if (trackInventory === false) return "in";
  const n = typeof stockQty === "number" && Number.isFinite(stockQty) ? stockQty : null;
  if (n === null) return "unknown";
  return n > 0 ? "in" : "out";
}

function stockBadge(status: StockStatus) {
  if (status === "in") return { text: "Disponibile", cls: "border-border" };
  if (status === "out") return { text: "Esaurito", cls: "border-red-200 text-red-600" };
  return { text: "Disponibilità da verificare", cls: "border-border text-text/70" };
}

async function checkIsBusiness(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const tf = cookieStore.get("tf_token")?.value ?? null;
    if (!tf) return false;

    const res = await fetch(`${SITE_URL}/api/account/type`, {
      cache: "no-store",
      headers: { Cookie: cookieStore.toString() },
    });
    if (!res.ok) return false;

    const json = await res.json().catch(() => null);
    const ct = String(json?.customerType ?? "").toUpperCase();
    return ct === "AZIENDE" || ct === "BUSINESS";
  } catch {
    return false;
  }
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
      robots: { index: false, follow: false },
    };
  }

  const prod =
    ((await getProductBySlug(slug)) as any as ProductLike | null) ??
    ((await getProductById(slug)) as any as ProductLike | null);

  if (!prod) {
    return {
      title: "Prodotto non trovato",
      description: "Il prodotto richiesto non è disponibile.",
      robots: { index: false, follow: false },
    };
  }

  const images = getImages(prod);
  const primaryImage = prod.seoImage || images[0];
  const rawTitle = (prod.seoTitle || prod.name).trim();
  const desc = clampText(
    prod.seoDescription ??
      prod.shortDescription ??
      richTextToPlainText(prod.description) ??
      prod.name,
    160
  );

  return {
    title: rawTitle,
    description: desc,
    alternates: { canonical: `${SITE_URL}/prodotto/${prod.slug}` },
    ...(prod.visibleInStorefront === false
      ? { robots: { index: false, follow: true } }
      : {}),
    openGraph: {
      title: rawTitle,
      description: desc,
      type: "website",
      url: `${SITE_URL}/prodotto/${prod.slug}`,
      images: primaryImage ? [{ url: primaryImage, alt: prod.name }] : undefined,
    },
  };
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

  const isBusiness = await checkIsBusiness();

  const rawPriceAziende = toNumber((product as any)?.priceAziende);
  const priceAziende =
    isBusiness && rawPriceAziende !== null && rawPriceAziende > 0 ? rawPriceAziende : null;

  const stockQty =
    typeof product?.stockQty === "number" && Number.isFinite(product.stockQty)
      ? product.stockQty
      : null;

  const trackInventory =
    typeof product?.trackInventory === "boolean" ? product.trackInventory : null;

  const status = getStockStatus(trackInventory, stockQty);
  const badge = stockBadge(status);

  const stockQtyUi = trackInventory === true && stockQty != null ? Math.max(0, stockQty) : null;

  const defaultSku = getDefaultSku(product);
  const availability = defaultSku
    ? await getAvailability({ skus: [defaultSku], warehouse: "MAIN" })
    : null;
  const row = defaultSku ? (availability as any)?.data?.MAIN?.[defaultSku] ?? null : null;

  const catSlug = product?.category?.slug ?? null;
  const subSlug = product?.subcategory?.slug ?? null;
  const macro = catSlug ? await getMacroBySlug(catSlug) : null;
  const sub = catSlug && subSlug ? await getSubBySlug(catSlug, subSlug) : null;
  const catLabel = product?.category?.label ?? macro?.label ?? catSlug ?? "";
  const subLabel = product?.subcategory?.label ?? sub?.label ?? subSlug ?? "";

  const related = (await getRelatedProducts(product as any, 8)) as any[];

  const price = toNumber(product?.price) ?? 0;
  const compareAt = toNumber(product?.compareAtPrice);
  const hasSale = compareAt != null && compareAt > price && price > 0;

  const shortDesc = clampText(
    product.shortDescription ?? richTextToPlainText(product.description),
    180
  );

  const rawProductDetails =
    (product as any)?.productDetails ??
    (product as any)?.productDetail ??
    (product as any)?.productdetails ??
    null;

  const detailsText = richTextToPlainText(rawProductDetails);
  const detailSpecs = normalizeSpecs(rawProductDetails ?? (product as any)?.specs);

  const cartId = String(product?.documentId ?? product?.id ?? product?.slug);
  const cartImage = (images?.[0] ?? product?.image ?? null) || undefined;
  const effectivePrice = priceAziende ?? price;

  const displayCode =
    defaultSku || String(product.id ?? product.documentId ?? "—");

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Catalogo", href: "/catalogo" },
    ...(catSlug && catLabel ? [{ label: catLabel, href: `/categoria/${catSlug}` }] : []),
    ...(catSlug && subSlug && subLabel
      ? [{ label: subLabel, href: `/categoria/${catSlug}/${subSlug}` }]
      : []),
    { label: product.name },
  ];

  // Schema.org JSON-LD: Product + Offer (prezzo pubblico B2C IVA inclusa)
  const productUrl = `${SITE_URL}/prodotto/${product.slug}`;
  const cleanGtin = String(product.gtin ?? "").replace(/\D/g, "");
  const jsonLdProduct: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    url: productUrl,
    ...(images.length ? { image: images } : {}),
    description:
      clampText(
        product.seoDescription ??
          product.shortDescription ??
          richTextToPlainText(product.description),
        300
      ) || product.name,
    sku: displayCode,
    ...(cleanGtin.length === 13
      ? { gtin13: cleanGtin }
      : cleanGtin.length >= 8
        ? { gtin: cleanGtin }
        : {}),
    brand: {
      "@type": "Brand",
      name: product.brand?.trim() || "Tavole & Favole",
    },
    ...(catLabel ? { category: subLabel ? `${catLabel} > ${subLabel}` : catLabel } : {}),
    ...(price > 0
      ? {
          offers: {
            "@type": "Offer",
            url: productUrl,
            priceCurrency: "EUR",
            price: price.toFixed(2),
            availability:
              status === "out"
                ? "https://schema.org/OutOfStock"
                : "https://schema.org/InStock",
            itemCondition: "https://schema.org/NewCondition",
            seller: {
              "@type": "Organization",
              name: "Tavole & Favole",
            },
          },
        }
      : {}),
  };

  const jsonLdBreadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.label,
      ...(item.href ? { item: `${SITE_URL}${item.href}` } : { item: productUrl }),
    })),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdProduct) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }}
      />

      <Breadcrumbs items={breadcrumbItems} />

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
            {product.brand ? (
              <div className="mb-1 text-xs font-bold uppercase tracking-wider text-text/60">
                {product.brand}
              </div>
            ) : null}

            <h1 className="text-3xl font-extrabold leading-tight">{product.name}</h1>

            {shortDesc ? (
              <p className="mt-3 text-sm text-text/70 md:text-base">{shortDesc}</p>
            ) : null}

            <div className="mt-4">
              {priceAziende !== null ? (
                <div className="flex flex-col gap-1">
                  <div className="flex items-baseline gap-3">
                    <div className="text-3xl font-extrabold text-primary">
                      € {priceAziende.toFixed(2)}
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary/80">
                      Prezzo azienda · IVA incl.
                    </span>
                  </div>
                  {price > 0 ? (
                    <div className="text-sm text-text/50 line-through">
                      Prezzo listino: € {price.toFixed(2)}
                    </div>
                  ) : null}
                </div>
              ) : price > 0 ? (
                <div className="flex flex-wrap items-baseline gap-3">
                  <div className="text-3xl font-extrabold">€ {price.toFixed(2)}</div>
                  {hasSale ? (
                    <div className="text-sm text-text/60 line-through">
                      € {compareAt!.toFixed(2)}
                    </div>
                  ) : null}
                  <span className="text-xs text-text/60">IVA inclusa</span>
                </div>
              ) : (
                <div className="text-lg font-extrabold text-text/60">Prezzo non disponibile</div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text/70">
              <span>
                Codice: <span className="text-text">{displayCode}</span>
              </span>
              {product.foodInfo?.quantitaNetta ? (
                <span>
                  Formato: <span className="font-semibold text-text">{product.foodInfo.quantitaNetta}</span>
                </span>
              ) : null}
            </div>

            {/* Sintesi Allergeni pre-acquisto (Reg. UE 1169/2011 Art. 14) */}
            {product.foodInfo?.allergeni ? (
              <div className="mt-3 rounded-xl border border-amber-300/80 bg-amber-50/60 px-3.5 py-2.5 text-xs text-amber-950">
                <span className="font-bold">Allergeni: </span>
                <span>{product.foodInfo.allergeni}</span>{" "}
                <a href="#scheda-tecnica" className="underline font-semibold">
                  Vedi etichetta
                </a>
              </div>
            ) : null}

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

              {stockQtyUi != null ? (
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-text/70">Quantità disponibile</span>
                  <span className="font-extrabold text-text">{stockQtyUi}</span>
                </div>
              ) : null}

              <p className="mt-2 text-sm text-text/70">
                {status === "in"
                  ? "Spedizione veloce: prepariamo l'ordine appena confermato."
                  : status === "out"
                    ? "Puoi comunque salvare il prodotto e tornare più tardi."
                    : "La disponibilità verrà confermata durante l'ordine."}
              </p>

              {process.env.NODE_ENV !== "production" ? (
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-text/60">
                  <span className="rounded-full border border-border px-3 py-1">
                    trackInventory: <b className="text-text">{String(trackInventory ?? "null")}</b>
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

              {effectivePrice > 0 ? (
                <div className="mt-3">
                  <AddToCartButton
                    id={cartId}
                    slug={product.slug}
                    name={product.name}
                    image={cartImage}
                    price={effectivePrice}
                    qty={1}
                    stockQty={stockQty}
                    trackInventory={trackInventory ?? undefined}
                    inStock={status !== "out"}
                    disabledLabel="Non disponibile"
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
                  Salva nei preferiti per ritrovarlo nell&apos;area personale.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <ProductTabs
        description={richTextToPlainText(product.description) || product.shortDescription || ""}
        descriptionBlocks={product.description}
        specs={detailSpecs}
        details={detailsText}
        foodInfo={product.foodInfo}
        nutrition={product.nutrition}
        weightGrams={product.weight_grams}
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
            const pPriceAziende = isBusiness ? toNumber(pRel?.priceAziende) : null;

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
                        src={cloudinaryThumb(String(pRel.image), 400)}
                        alt={String(pRel.name ?? "")}
                        width={400}
                        height={300}
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

                    {pPriceAziende !== null && pPriceAziende > 0 ? (
                      <div className="mt-2 flex flex-col gap-0.5">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-bold text-primary">
                            € {pPriceAziende.toFixed(2)}
                          </span>
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary/80">
                            Azienda
                          </span>
                        </div>
                        {pPrice > 0 ? (
                          <span className="text-xs line-through text-text/50">
                            € {pPrice.toFixed(2)}
                          </span>
                        ) : null}
                      </div>
                    ) : (
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
                    )}
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