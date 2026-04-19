import type { Metadata } from "next";

const mainlandRates = [
  { range: "da 0 g a 2.000 g", price: "euro 7,70" },
  { range: "da 2.001 g a 5.000 g", price: "euro 9,00" },
  { range: "da 5.001 g a 10.000 g", price: "euro 10,90" },
  { range: "da 10.001 g a 20.000 g", price: "euro 12,90" },
  { range: "oltre 20.001 g", price: "euro 20,00" },
];

const islandRates = [
  { range: "da 0 g a 2.000 g", price: "euro 9,70" },
  { range: "da 2.001 g a 5.000 g", price: "euro 11,00" },
  { range: "da 5.001 g a 10.000 g", price: "euro 12,90" },
  { range: "da 10.001 g a 20.000 g", price: "euro 14,90" },
  { range: "oltre 20.001 g", price: "euro 22,00" },
];

export const metadata: Metadata = {
  title: "Spedizioni",
};

export default function SpedizioniPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header>
        <h1 className="text-3xl font-semibold">Spedizioni</h1>
        <p className="mt-3 text-base leading-7 text-text/70">
          Tavole e Favole effettua spedizioni esclusivamente in Italia, comprese
          le isole.
        </p>
      </header>

      <div className="mt-8 space-y-8 text-base leading-7">
        <section>
          <h2 className="text-xl font-semibold">Tempi di preparazione e consegna</h2>
          <div className="mt-4 space-y-4 text-text/80">
            <p>
              Gli ordini vengono preparati ed evasi nei giorni lavorativi, dal
              lunedì al venerdì. Gli ordini ricevuti entro le ore 9:00 possono
              essere affidati al corriere nella stessa giornata lavorativa;
              quelli ricevuti oltre tale orario vengono normalmente lavorati il
              primo giorno lavorativo successivo.
            </p>
            <p>
              Il tempo medio di preparazione dell&apos;ordine è di 1 giorno
              lavorativo. I tempi medi di consegna sono di 24/48 ore lavorative
              dalla spedizione. Queste tempistiche sono indicative e possono
              variare per cause esterne, come ritardi del corriere, festività,
              periodi di intenso traffico logistico o eventi straordinari.
            </p>
            <p>
              Le spedizioni sono affidate al corriere SDA e sono tracciabili.
              Quando la spedizione viene presa in carico, il cliente riceve una
              comunicazione email con le informazioni utili per il tracciamento,
              se disponibili.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Costi di spedizione</h2>
          <p className="mt-4 text-text/80">
            Le spese di spedizione vengono calcolate in base alla destinazione e
            al peso complessivo dell&apos;ordine.
          </p>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <section className="rounded-3xl border border-border bg-background p-6">
              <h3 className="text-lg font-semibold">Italia continentale</h3>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-text/80">
                {mainlandRates.map((item) => (
                  <li
                    key={item.range}
                    className="flex items-start justify-between gap-4 border-b border-border/60 pb-3 last:border-b-0 last:pb-0"
                  >
                    <span>{item.range}</span>
                    <span className="whitespace-nowrap font-medium">{item.price}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-3xl border border-border bg-background p-6">
              <h3 className="text-lg font-semibold">Isole</h3>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-text/80">
                {islandRates.map((item) => (
                  <li
                    key={item.range}
                    className="flex items-start justify-between gap-4 border-b border-border/60 pb-3 last:border-b-0 last:pb-0"
                  >
                    <span>{item.range}</span>
                    <span className="whitespace-nowrap font-medium">{item.price}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <p className="mt-4 text-text/80">
            Per gli ordini superiori a euro 79,00 è prevista la spedizione
            gratuita, salvo eventuali eccezioni indicate nel sito o nel
            checkout.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Consegna e giacenza</h2>
          <div className="mt-4 space-y-4 text-text/80">
            <p>
              Il cliente è tenuto a inserire dati di spedizione completi e
              corretti. Eventuali ritardi, costi aggiuntivi, giacenze,
              riconsegne o rientri della merce dovuti a dati errati o
              incompleti resteranno a carico del cliente.
            </p>
            <p>
              In caso di mancata consegna al primo tentativo, il corriere
              effettua un secondo tentativo. Se anche questo non va a buon fine,
              la spedizione può andare in giacenza, con eventuali costi
              aggiuntivi di gestione, riconsegna o rientro.
            </p>
            <p>
              Al momento della consegna, il cliente è invitato a controllare,
              per quanto possibile, l&apos;integrità esterna del collo. Se il pacco
              presenta danni evidenti o anomalie, è consigliabile accettare la
              consegna con riserva di controllo, chiedendo al corriere di
              annotarlo.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Periodi di maggiore operatività</h2>
          <p className="mt-4 text-text/80">
            Nel mese di agosto e nei periodi vicini alle festività, le
            spedizioni potrebbero subire ritardi a causa dell&apos;elevato volume di
            ordini e delle tempistiche dei corrieri. Tavole e Favole farà
            comunque il possibile per rispettare i tempi di lavorazione e
            spedizione indicati.
          </p>
        </section>
      </div>
    </main>
  );
}
