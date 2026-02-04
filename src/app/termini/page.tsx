import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termini e condizioni",
};

export default function TerminiPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header>
        <h1 className="text-3xl font-semibold">Termini e condizioni</h1>
        <p className="mt-3 text-base leading-7 text-text/70">
          Stiamo completando questa sezione con i Termini e Condizioni ufficiali
          relativi a ordini, pagamenti, spedizioni, resi e assistenza.
        </p>
      </header>

      <section className="mt-8 rounded-3xl border border-border bg-background p-6">
        <h2 className="text-lg font-semibold">Nel frattempo</h2>
        <p className="mt-2 text-sm leading-6 text-text/70">
          Puoi consultare queste pagine già disponibili:
        </p>

        <ul className="mt-4 space-y-3 text-sm">
          <li className="rounded-2xl border border-border bg-surface p-4">
            <div className="font-semibold">Spedizioni</div>
            <div className="mt-1 text-text/70">
              Tempi e modalità di consegna.
            </div>
            <Link href="/spedizioni" className="mt-2 inline-block font-semibold text-link hover:text-link-hover">
              Vai a Spedizioni →
            </Link>
          </li>

          <li className="rounded-2xl border border-border bg-surface p-4">
            <div className="font-semibold">Resi & rimborsi</div>
            <div className="mt-1 text-text/70">
              Procedura e condizioni per reso e rimborso.
            </div>
            <Link href="/resi" className="mt-2 inline-block font-semibold text-link hover:text-link-hover">
              Vai a Resi →
            </Link>
          </li>

          <li className="rounded-2xl border border-border bg-surface p-4">
            <div className="font-semibold">Privacy & Cookie</div>
            <div className="mt-1 text-text/70">
              Documentazione aggiornata tramite Iubenda.
            </div>
            <div className="mt-2 flex flex-wrap gap-3">
              <Link href="/privacy-policy" className="font-semibold text-link hover:text-link-hover">
                Privacy →
              </Link>
              <Link href="/cookie-policy" className="font-semibold text-link hover:text-link-hover">
                Cookie →
              </Link>
            </div>
          </li>

          <li className="rounded-2xl border border-border bg-surface p-4">
            <div className="font-semibold">Contatti</div>
            <div className="mt-1 text-text/70">
              Se hai dubbi prima o dopo l’acquisto, contattaci: rispondiamo il prima possibile.
            </div>
            <Link href="/contatti" className="mt-2 inline-block font-semibold text-link hover:text-link-hover">
              Vai a Contatti →
            </Link>
          </li>
        </ul>
      </section>

      <section className="mt-8 text-sm text-text/70">
        <p>
          Nota: i Termini e Condizioni completi verranno pubblicati qui appena disponibili.
        </p>
      </section>
    </main>
  );
}
