"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Container from "@/components/Container";
import ProductCard from "@/components/ProductCard";
import AddToCartButton from "@/components/cart/AddToCartButton";
import { products as mockProducts } from "@/lib/data";
import type { HomeCta } from "@/config/home";

type Props = {
  title?: string;
  subtitle?: string;
  viewAll?: HomeCta;
  limit?: number;

  /**
   * ✅ In futuro: passa qui i prodotti reali da Strapi (server-side)
   * Esempio: <SectionFeaturedProducts products={productsFromStrapi} />
   */
  products?: any[];
};

function ArrowLeftIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M12.5 4.5L7.5 10l5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ArrowRightIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M7.5 4.5L12.5 10l-5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function toId(p: any): string {
  return String(p?.documentId ?? p?.id ?? "").trim();
}

function toSlug(p: any): string {
  return String(p?.slug ?? "").trim();
}

function toName(p: any): string {
  return String(p?.name ?? "Prodotto").trim();
}

function toImage(p: any): string | undefined {
  return p?.image ?? undefined;
}

function toPrice(p: any): number {
  const n = Number(p?.price);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export default function SectionFeaturedProducts(props: Props) {
  const limit = props.limit ?? 8;

  // ✅ Fonte dati: se props.products esiste usa quello, altrimenti mock
  const source = (props.products?.length ? props.products : mockProducts) as any[];

  const featured = useMemo(() => source.slice(0, limit), [source, limit]);

  const title = props.title ?? "Prodotti in evidenza";
  const subtitle = props.subtitle ?? "Selezione consigliata del momento.";
  const viewAll = props.viewAll ?? { label: "Vedi tutti", href: "/catalogo" };

  // Desktop carousel
  const railRef = useRef<HTMLDivElement | null>(null);
  const [canScroll, setCanScroll] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  function updateRailState() {
    const el = railRef.current;
    if (!el) return;

    const max = el.scrollWidth - el.clientWidth;
    const x = el.scrollLeft;

    setCanScroll(max > 2);
    setAtStart(x <= 2);
    setAtEnd(x >= max - 2);
  }

  useEffect(() => {
    updateRailState();

    const el = railRef.current;
    if (!el) return;

    const onScroll = () => updateRailState();
    el.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(() => updateRailState());
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [featured.length]);

  function scrollByPage(dir: -1 | 1) {
    const el = railRef.current;
    if (!el) return;

    const amount = Math.max(240, Math.floor(el.clientWidth * 0.9));
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  }

  return (
    <section aria-label={title} className="py-12">
      <Container>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-text smart-wrap">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-muted-text smart-wrap">{subtitle}</p> : null}
          </div>

          {viewAll?.href ? (
            <Link href={viewAll.href} className="text-sm text-link hover:text-link-hover tap-target">
              {viewAll.label}
            </Link>
          ) : null}
        </div>

        {/* MOBILE */}
        <div className="mt-6 md:hidden">
          <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 no-scrollbar [scroll-snap-type:x_mandatory]">
            {featured.map((p) => (
              <div key={toId(p) || toSlug(p)} className="w-[240px] flex-none [scroll-snap-align:start] h-full">
                <ProductCard
                  product={p}
                  footer={
                    <AddToCartButton
                      id={toId(p)}
                      slug={toSlug(p)}
                      name={toName(p)}
                      image={toImage(p)}
                      price={toPrice(p)}
                      stockQty={p?.stockQty ?? null}
                      trackInventory={p?.trackInventory}
                    />
                  }
                />
              </div>
            ))}
          </div>
        </div>

        {/* DESKTOP */}
        <div className="mt-6 hidden md:block">
          <div className="relative">
            {canScroll ? (
              <button
                type="button"
                onClick={() => scrollByPage(-1)}
                disabled={atStart}
                aria-label="Scorri indietro"
                className={`absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border bg-background/90 p-2 shadow-sm backdrop-blur
                  hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                  ${atStart ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                <ArrowLeftIcon />
              </button>
            ) : null}

            {canScroll ? (
              <button
                type="button"
                onClick={() => scrollByPage(1)}
                disabled={atEnd}
                aria-label="Scorri avanti"
                className={`absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border bg-background/90 p-2 shadow-sm backdrop-blur
                  hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                  ${atEnd ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                <ArrowRightIcon />
              </button>
            ) : null}

            <div
              ref={railRef}
              className={`-mx-2 flex gap-4 overflow-x-auto px-2 pb-2 no-scrollbar [scroll-snap-type:x_mandatory]
                ${canScroll ? "scroll-smooth" : ""}`}
            >
              {featured.map((p) => (
                <div key={toId(p) || toSlug(p)} className="w-[260px] lg:w-[280px] flex-none [scroll-snap-align:start] h-full">
                  <ProductCard
                    product={p}
                    footer={
                      <AddToCartButton
                        id={toId(p)}
                        slug={toSlug(p)}
                        name={toName(p)}
                        image={toImage(p)}
                        price={toPrice(p)}
                        stockQty={p?.stockQty ?? null}
                        trackInventory={p?.trackInventory}
                      />
                    }
                  />
                </div>
              ))}
            </div>

            {canScroll ? (
              <>
                <div
                  className={`pointer-events-none absolute left-0 top-0 h-full w-10 bg-gradient-to-r from-background to-transparent transition-opacity ${
                    atStart ? "opacity-0" : "opacity-100"
                  }`}
                  aria-hidden="true"
                />
                <div
                  className={`pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-background to-transparent transition-opacity ${
                    atEnd ? "opacity-0" : "opacity-100"
                  }`}
                  aria-hidden="true"
                />
              </>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}
