import Link from "next/link";
import { notFound } from "next/navigation";
import Container from "@/components/Container";
import { categories, products, getCurrentOccasion } from "@/lib/data";
import DebugCartPanel from "@/components/DebugCartPanel";

export const metadata = {
  title: "Debug",
};

export default function DebugPage() {
  // Sicurezza: la pagina /debug non deve essere pubblica in produzione.
  if (process.env.NODE_ENV !== "development") {
    return notFound();
  }

  const occ = getCurrentOccasion();

  return (
    <Container>
      <div className="py-10">
        <h1 className="text-2xl font-semibold text-text">Debug</h1>
        <p className="mt-2 text-sm text-muted-text">
          Pagina interna per verificare dati, routing e carrello (solo locale).
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-background p-5">
            <div className="text-sm font-semibold text-text">Dati</div>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-text">Categorie</dt>
                <dd className="text-text">{categories.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-text">Prodotti</dt>
                <dd className="text-text">{products.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-text">Ricorrenza attiva</dt>
                <dd className="text-text">{occ.name}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-border bg-background p-5 lg:col-span-2">
            <div className="text-sm font-semibold text-text">Link rapidi</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link className="rounded-full bg-surface px-3 py-2 text-sm hover:bg-surface-2" href="/">
                Home
              </Link>
              <Link className="rounded-full bg-surface px-3 py-2 text-sm hover:bg-surface-2" href="/catalogo">
                Catalogo
              </Link>
              <Link className="rounded-full bg-surface px-3 py-2 text-sm hover:bg-surface-2" href="/ricorrenze">
                Ricorrenze
              </Link>
              <Link className="rounded-full bg-surface px-3 py-2 text-sm hover:bg-surface-2" href="/carrello">
                Carrello
              </Link>
              <Link className="rounded-full bg-surface px-3 py-2 text-sm hover:bg-surface-2" href="/account">
                Account
              </Link>
              <Link className="rounded-full bg-surface px-3 py-2 text-sm hover:bg-surface-2" href="/supporto">
                Supporto
              </Link>
            </div>

            <div className="mt-5 text-sm text-muted-text">
              Suggerimento: tieni questa pagina aperta mentre testi, così controlli rapidamente lo stato del carrello.
            </div>
          </div>
        </div>

        <div className="mt-6">
          <DebugCartPanel />
        </div>
      </div>
    </Container>
  );
}
