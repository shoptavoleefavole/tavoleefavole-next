import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Container from "@/components/Container";
import Breadcrumbs from "@/components/Breadcrumbs";
import ProductCard from "@/components/ProductCard";
import AddToCartButton from "@/components/cart/AddToCartButton";
import { getOccasionBySlug, getProductsForOccasion, occasions } from "@/lib/data";

type OccasionParams = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<OccasionParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const occ = getOccasionBySlug(slug);

  return {
    title: occ ? `Ricorrenza: ${occ.name}` : "Ricorrenza",
    description: occ?.description ?? "Pagina ricorrenza",
    openGraph: {
      title: occ ? `Ricorrenza: ${occ.name}` : "Ricorrenza",
      description: occ?.description ?? "Pagina ricorrenza",
      images: occ?.heroImage ? [{ url: occ.heroImage }] : [],
    },
  };
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

export default async function OccasionPage({
  params,
}: {
  params: Promise<OccasionParams>;
}) {
  const { slug } = await params;

  const occ = getOccasionBySlug(slug);
  const list = getProductsForOccasion(slug);

  const crumbs = [
    { label: "Home", href: "/" },
    { label: "Ricorrenze", href: "/ricorrenze" },
    { label: occ?.name ?? slug },
  ];

  return (
    <Container>
      <div className="py-8">
        <Breadcrumbs items={crumbs} />

        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="relative aspect-[16/6] min-h-[180px]">
            <Image
              src={occ?.heroImage ?? "https://picsum.photos/seed/occ-generic/1400/900"}
              alt={occ?.name ?? "Ricorrenza"}
              fill
              className="object-cover"
              priority
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.55),rgba(0,0,0,0.05))]" />
            <div className="absolute inset-0 flex items-end p-6">
              <div className="max-w-xl text-text-on-dark">
                <div className="text-xs font-semibold opacity-90">Sezione stagionale (placeholder)</div>
                <h1 className="mt-2 text-3xl font-semibold">{occ?.name ?? "Ricorrenza"}</h1>
                <p className="mt-2 text-sm opacity-90">{occ?.description ?? "Descrizione placeholder."}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {occasions.map((o) => (
            <Link
              key={o.slug}
              href={`/ricorrenze/${o.slug}`}
              className={`rounded-full px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                o.slug === slug ? "bg-surface text-text" : "bg-background text-muted-text hover:bg-surface-2"
              }`}
            >
              {o.name}
            </Link>
          ))}
        </div>

        <section className="mt-6" aria-label="Prodotti ricorrenza">
          {list.length === 0 ? (
            <div className="rounded-2xl border border-border bg-background p-8 text-center">
              <div className="text-base font-semibold text-text">Nessun prodotto</div>
              <p className="mt-1 text-sm text-muted-text">Configura i productIds della ricorrenza in `data.ts`.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {list.map((p: any) => (
                <div key={toId(p) || toSlug(p)} className="h-full">
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
          )}
        </section>
      </div>
    </Container>
  );
}

export function generateStaticParams() {
  return occasions.map((o) => ({ slug: o.slug }));
}
