import Link from "next/link";

export const dynamic = "force-dynamic";

export default function RegisterBusinessPlaceholder() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-3xl font-extrabold">Registrazione Azienda</h1>
      <p className="mt-3 text-sm text-text/70">
        Qui inseriremo i campi aziendali (ragione sociale, P.IVA, PEC, SDI, ecc.).
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <div className="text-sm font-extrabold">Step successivo</div>
        <p className="mt-1 text-sm text-text/70">
          Creiamo la form completa e inviamo <b>type: "BUSINESS"</b> al tuo endpoint.
        </p>
      </div>

      <div className="mt-6 flex gap-3">
        <Link
          href="/registrati"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-extrabold hover:bg-surface"
        >
          ← Indietro
        </Link>

        <Link
          href="/registrati/privato"
          className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover"
        >
          Vai a Privato
        </Link>
      </div>
    </main>
  );
}
