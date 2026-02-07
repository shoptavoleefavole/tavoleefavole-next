import Image from "next/image";
import Link from "next/link";
import Container from "@/components/Container";
import { categories, getCurrentOccasion } from "@/lib/data";

export default function SectionCategoryTiles() {
  const list = categories.slice(0, 6);
  const occ = getCurrentOccasion();

  return (
    <section aria-label="Categorie" className="bg-secondary py-12">
      <Container>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-text">Categorie</h2>
            <p className="mt-1 text-sm text-muted-text">Seleziona una categoria per iniziare.</p>
          </div>

          <Link href={`/ricorrenze/${occ.slug}`} className="text-sm text-link hover:text-link-hover">
            Ricorrenza attiva: {occ.name}
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <Link
              key={c.slug}
              href={`/categoria/${c.slug}`}
              className="group overflow-hidden rounded-2xl border border-border bg-background shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="relative aspect-[16/9] bg-surface">
                <Image
                  src={c.image ?? "https://picsum.photos/seed/cat/1200/800"}
                  alt={c.name}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-text">{c.name}</div>
                    <div className="mt-1 line-clamp-2 text-sm text-muted-text">{c.description}</div>
                  </div>
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-text"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
