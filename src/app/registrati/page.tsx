import Link from "next/link";

export const dynamic = "force-dynamic";

export default function RegisterChoicePage() {
  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="rounded-3xl border border-border bg-background p-6 shadow-sm">
        <h1 className="text-3xl font-extrabold">Crea il tuo account</h1>
        <p className="mt-2 text-sm text-text/70">
          Seleziona il tipo di profilo per completare la registrazione.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {/* PRIVATO */}
          <Link
            href="/registrati/privato"
            className="group rounded-2xl border border-border bg-background p-6 shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-extrabold">Privato</div>
                <p className="mt-1 text-sm text-text/70">
                  Per acquisti personali. Potrai inserire (facoltativo) il codice fiscale per la fattura.
                </p>
              </div>
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-text/70">
                B2C
              </span>
            </div>

            <div className="mt-4 inline-flex items-center gap-2 text-sm font-extrabold text-primary">
              Continua <span aria-hidden="true">›</span>
            </div>
          </Link>

          {/* AZIENDA */}
          <Link
            href="/registrati/azienda"
            className="group rounded-2xl border border-border bg-background p-6 shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-extrabold">Azienda</div>
                <p className="mt-1 text-sm text-text/70">
                  Per attività e professionisti. Ti chiederemo Ragione sociale, P.IVA, PEC e SDI (tutti obbligatori).
                </p>
              </div>
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-text/70">
                B2B
              </span>
            </div>

            <div className="mt-4 inline-flex items-center gap-2 text-sm font-extrabold text-primary">
              Continua <span aria-hidden="true">›</span>
            </div>
          </Link>
        </div>

        <div className="mt-6 flex items-center justify-between text-sm">
          <span className="text-text/70">Hai già un account?</span>
          <Link href="/accedi" className="font-semibold underline">
            Accedi
          </Link>
        </div>
      </div>
    </main>
  );
}
