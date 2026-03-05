// src/app/chi-siamo/page.tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Chi siamo",
  description:
    "Dal 1999 selezioniamo prodotti per pasticceria, cake design e occasioni speciali: decorazioni, cioccolatini, bottiglie da regalo e Caffè Quarta.",
};

export default function ChiSiamoPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight">Chi siamo</h1>
        <p className="mt-3 text-base leading-7 text-text/70">
          <strong>Tavole &amp; Favole</strong> nasce nel 1999 con un’idea semplice:
          aiutare chi ama creare dolci e momenti speciali a trovare prodotti affidabili,
          belli da vedere e perfetti da usare. Da oltre 25 anni selezioniamo con cura
          ingredienti, accessori e decorazioni per risultati concreti, in laboratorio e a casa.
        </p>
      </header>

      <section className="mt-8 overflow-hidden rounded-3xl border border-border bg-surface">
        <div className="relative w-full aspect-[16/9] overflow-hidden rounded-2xl">
          <Image
            src="/chi-siamo/chi-siamo-negozio.webp"
            alt="Tavole & Favole - illustrazione del negozio"
            fill
            sizes="(max-width: 768px) 100vw, 800px"
            className="object-cover"
            priority
          />
        </div>


        <div className="p-6 sm:p-8">
          <h2 className="text-lg font-semibold">Una selezione fatta con cura</h2>
          <p className="mt-2 text-sm leading-6 text-text/70">
            In questi anni abbiamo costruito una proposta completa per chi fa pasticceria,
            cake design e decorazioni: strumenti, ingredienti, dettagli scenografici e
            piccole “chicche” che fanno la differenza.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background p-5">
              <div className="text-sm font-semibold">Pasticceria &amp; Cake Design</div>
              <p className="mt-2 text-sm text-text/70">
                Prodotti selezionati per torte, dolci e decorazioni: praticità, resa e qualità.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-background p-5">
              <div className="text-sm font-semibold">Caramelle &amp; Cioccolatini</div>
              <p className="mt-2 text-sm text-text/70">
                Una vasta scelta dei migliori marchi, perfetta per eventi, bomboniere e regali.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-background p-5">
              <div className="text-sm font-semibold">Bottiglie da regalo</div>
              <p className="mt-2 text-sm text-text/70">
                Idee curate e di impatto, per celebrare occasioni importanti con gusto.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-background p-5">
              <div className="text-sm font-semibold">Caffè Quarta</div>
              <p className="mt-2 text-sm text-text/70">
                Un’eccellenza italiana: profumo, carattere e qualità, per chi non accetta compromessi.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-background p-5">
            <div className="text-sm font-semibold">Il nostro modo di lavorare</div>
            <p className="mt-2 text-sm text-text/70">
              Puntiamo su un’esperienza chiara e affidabile: informazioni semplici, scelta guidata,
              e supporto reale quando serve. Che tu stia preparando una torta importante o un piccolo
              regalo, vogliamo farti arrivare al risultato con serenità.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/catalogo"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover"
            >
              Vai al catalogo
            </Link>
            <Link
              href="/contatti"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background px-5 text-sm font-extrabold hover:bg-surface-2"
            >
              Contattaci
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
