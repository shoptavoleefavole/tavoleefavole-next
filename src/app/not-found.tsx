import Link from "next/link";

export const metadata = {
  title: "Pagina non trovata",
};

export default function NotFound() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <h1 className="text-3xl font-extrabold">Pagina non trovata</h1>
      <p className="mt-3 text-sm text-text/70">
        L’URL potrebbe essere errato oppure la pagina è stata rimossa o spostata.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/"
          className="rounded-xl bg-primary px-4 py-3 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover"
        >
          Torna alla Home
        </Link>

        <Link
          href="/catalogo"
          className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-bold hover:bg-surface-2"
        >
          Vai al Catalogo
        </Link>

        <Link
          href="/contatti"
          className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-bold hover:bg-surface-2"
        >
          Contattaci
        </Link>
      </div>
    </div>
  );
}
