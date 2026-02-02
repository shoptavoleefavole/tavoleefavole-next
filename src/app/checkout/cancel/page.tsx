import Link from "next/link";

export const metadata = {
  title: "Pagamento annullato",
};

export default function CheckoutCancelPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-extrabold">Pagamento annullato</h1>
      <p className="mt-3 text-sm text-text/70">
        Nessun problema: il carrello è ancora disponibile.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/carrello"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover"
        >
          Torna al carrello
        </Link>

        <Link
          href="/catalogo"
          className="rounded-xl border border-border px-4 py-2 text-sm font-extrabold hover:bg-surface-2"
        >
          Vai al catalogo
        </Link>
      </div>
    </main>
  );
}
