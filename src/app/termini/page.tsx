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
          Le presenti condizioni regolano la vendita dei prodotti tramite il
          sito Tavole e Favole. Prima di effettuare un ordine, il cliente è
          invitato a leggere con attenzione questa pagina.
        </p>
      </header>

      <section className="mt-8 rounded-3xl border border-border bg-background p-6">
        <h2 className="text-lg font-semibold">1. Identità del venditore</h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-text/80">
          <p>
            Il presente sito e-commerce è gestito da <strong>Tavole e Favole</strong>,
            Partita IVA <strong>03328700756</strong>, con sede legale in Via Don
            Alessandro Niccoli, 35/A, Carmiano.
          </p>
          <p>
            Per informazioni o assistenza, il cliente può contattare Tavole e
            Favole ai seguenti recapiti:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Email:{" "}
              <a
                href="mailto:shoptavoleefavole@gmail.com"
                className="font-medium text-link hover:text-link-hover"
              >
                shoptavoleefavole@gmail.com
              </a>
            </li>
            <li>
              PEC:{" "}
              <a
                href="mailto:tavoleefavole@pec.it"
                className="font-medium text-link hover:text-link-hover"
              >
                tavoleefavole@pec.it
              </a>
            </li>
            <li>
              Telefono / WhatsApp:{" "}
              <a
                href="tel:+393482783901"
                className="font-medium text-link hover:text-link-hover"
              >
                3482783901
              </a>
            </li>
          </ul>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-border bg-background p-6">
        <h2 className="text-lg font-semibold">2. Ambito di applicazione</h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-text/80">
          <p>
            Le presenti Condizioni Generali regolano la vendita dei prodotti
            commercializzati tramite il sito Tavole e Favole.
          </p>
          <p>
            Le vendite sono effettuate esclusivamente in Italia, in lingua
            italiana, con prezzi espressi in euro e comprensivi di IVA.
          </p>
          <p>
            Tavole e Favole vende sia a Clienti Consumatori sia a Clienti
            Professionisti. Le tutele previste dalla normativa a favore del
            consumatore si applicano ai Clienti Consumatori nei casi previsti
            dalla legge.
          </p>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-border bg-background p-6">
        <h2 className="text-lg font-semibold">3. Prodotti e dettagli prodotto</h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-text/80">
          <p>
            Tavole e Favole commercializza prodotti per uso alimentare, tra cui,
            a titolo esemplificativo, dolci confezionati, lievitati, conserve,
            prodotti secchi, box regalo e prodotti artigianali su ordinazione.
          </p>
          <p>
            Alcuni prodotti possono essere personalizzati su richiesta del
            cliente. Altri possono essere venduti in confezione sigillata e,
            una volta aperti, potrebbero non essere restituibili nei casi
            previsti dalla legge.
          </p>
          <p>
            Le informazioni essenziali relative a ciascun prodotto sono
            riportate nella sezione <strong>“Dettagli prodotto”</strong>. Il
            cliente è invitato a leggere attentamente tutte le informazioni
            disponibili prima di completare l&apos;acquisto, con particolare
            attenzione a ingredienti, allergeni, quantità/netto peso e modalità
            di conservazione.
          </p>
          <p>
            Per qualsiasi dubbio o richiesta di chiarimento, il servizio
            clienti è a disposizione.
          </p>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-border bg-background p-6">
        <h2 className="text-lg font-semibold">4. Disponibilità dei prodotti</h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-text/80">
          <p>
            Tavole e Favole vende normalmente prodotti disponibili a magazzino.
          </p>
          <p>
            Eventuali preordini possono essere valutati contattando
            preventivamente il servizio clienti.
          </p>
          <p>
            Se, dopo l&apos;invio dell&apos;ordine, uno o più prodotti risultano
            indisponibili, il cliente verrà contattato dall&apos;assistenza e
            riceverà il rimborso dell&apos;importo pagato per il prodotto non
            disponibile.
          </p>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-border bg-background p-6">
        <h2 className="text-lg font-semibold">5. Prezzi</h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-text/80">
          <p>
            Tutti i prezzi sono espressi in euro e comprensivi di IVA.
          </p>
          <p>
            Le eventuali spese di spedizione vengono indicate separatamente
            prima della conclusione dell&apos;ordine.
          </p>
          <p>
            Se il cliente ha pagato un importo superiore al prezzo corretto
            pubblicato sul sito al momento dell&apos;acquisto, Tavole e Favole
            provvederà al rimborso della differenza.
          </p>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-border bg-background p-6">
        <h2 className="text-lg font-semibold">
          6. Modalità di acquisto, pagamenti e conclusione del contratto
        </h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-text/80">
          <p>
            Per effettuare un acquisto, il cliente deve seguire la procedura
            indicata sul sito, inserendo dati completi, aggiornati e corretti.
          </p>
          <p>
            Il pagamento dell&apos;ordine avviene dopo che il cliente ha completato
            la procedura di pagamento tramite i sistemi disponibili nel
            checkout.
          </p>
          <p>
            Tra i metodi di pagamento indicati nel checkout rientrano PayPal,
            Link, Klarna, carte di pagamento, Satispay, Google Play e Revolut
            Play.
          </p>
          <p>
            Il contratto di vendita si considera concluso nel momento in cui il
            venditore invia al cliente la conferma d&apos;ordine via email.
          </p>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-border bg-background p-6">
        <h2 className="text-lg font-semibold">7. Modifica o annullamento dell&apos;ordine</h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-text/80">
          <p>
            Il cliente può richiedere la modifica o l&apos;annullamento
            dell&apos;ordine prima della spedizione, contattando tempestivamente
            il servizio clienti.
          </p>
          <p>
            Tavole e Favole verificherà la possibilità di accogliere la
            richiesta in base allo stato di lavorazione dell&apos;ordine.
          </p>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-border bg-background p-6">
        <h2 className="text-lg font-semibold">8. Spedizione e consegna</h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-text/80">
          <p>
            Tempi, modalità e costi di spedizione sono descritti nella pagina{" "}
            <Link
              href="/spedizioni"
              className="font-medium text-link hover:text-link-hover"
            >
              Spedizioni
            </Link>
            , che costituisce parte integrante delle presenti Condizioni
            Generali.
          </p>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-border bg-background p-6">
        <h2 className="text-lg font-semibold">
          9. Recesso, resi, reclami e conformità
        </h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-text/80">
          <p>
            Le condizioni relative a recesso, resi, rimborsi, reclami e
            segnalazioni di prodotti danneggiati, deteriorati, errati o non
            conformi sono descritte nella pagina{" "}
            <Link
              href="/resi"
              className="font-medium text-link hover:text-link-hover"
            >
              Resi e rimborsi
            </Link>
            , che costituisce parte integrante delle presenti Condizioni
            Generali.
          </p>
          <p>
            In caso di prodotto difettoso o non conforme, Tavole e Favole
            provvederà, dopo le opportune verifiche, alla sostituzione o al
            rimborso del prodotto secondo quanto previsto dalla normativa
            vigente.
          </p>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-border bg-background p-6">
        <h2 className="text-lg font-semibold">10. Vendita di prodotti alcolici</h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-text/80">
          <p>
            L&apos;acquisto di prodotti alcolici è consentito esclusivamente a chi
            ha compiuto 18 anni.
          </p>
          <p>
            Al momento dell&apos;acquisto viene richiesto un documento di identità
            per verificare la maggiore età dell&apos;acquirente. Se dalla verifica
            risulta che l&apos;acquirente è minorenne, l&apos;ordine viene annullato e
            l&apos;importo pagato viene restituito.
          </p>
          <p>
            Effettuando un ordine contenente prodotti alcolici, il cliente
            dichiara di essere maggiorenne e di accettare questa verifica.
          </p>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-border bg-background p-6">
        <h2 className="text-lg font-semibold">11. Documento fiscale e fatturazione</h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-text/80">
          <p>
            All&apos;interno del pacco viene inserito il documento commerciale,
            comunemente chiamato scontrino fiscale.
          </p>
          <p>
            La fattura deve essere richiesta dal cliente secondo le modalità e
            nei tempi previsti dalla normativa fiscale applicabile.
          </p>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-border bg-background p-6">
        <h2 className="text-lg font-semibold">12. Responsabilità</h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-text/80">
          <p>
            Tavole e Favole non risponde di ritardi o mancata esecuzione dovuti
            a cause esterne non dipendenti dalla propria volontà, come ad
            esempio eventi di forza maggiore, interruzioni dei trasporti,
            scioperi, blocchi logistici, guasti di rete o malfunzionamenti dei
            sistemi di pagamento.
          </p>
          <p>
            Restano in ogni caso validi i diritti riconosciuti al consumatore
            dalla legge.
          </p>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-border bg-background p-6">
        <h2 className="text-lg font-semibold">13. Legge applicabile e foro competente</h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-text/80">
          <p>Le presenti Condizioni Generali sono regolate dalla legge italiana.</p>
          <p>
            Per le controversie con il Cliente Consumatore, è competente il
            giudice del luogo di residenza o domicilio del consumatore, se
            situato in Italia.
          </p>
          <p>
            Per i Clienti Professionisti, la competenza è determinata secondo le
            regole ordinarie di legge, salvo diverso accordo scritto tra le
            parti.
          </p>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-border bg-background p-6">
        <h2 className="text-lg font-semibold">14. Reclami e assistenza</h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-text/80">
          <p>
            Eventuali reclami o richieste di assistenza possono essere inviati ai
            recapiti indicati nelle presenti Condizioni Generali.
          </p>
          <p>
            Tavole e Favole si impegna a gestire le segnalazioni nel più breve
            tempo possibile.
          </p>
          <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
            <div className="font-semibold text-text">Pagine utili</div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <Link
                href="/spedizioni"
                className="font-medium text-link hover:text-link-hover"
              >
                Spedizioni →
              </Link>
              <Link
                href="/resi"
                className="font-medium text-link hover:text-link-hover"
              >
                Resi e rimborsi →
              </Link>
              <a
                href="https://www.iubenda.com/privacy-policy/47702140"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-link hover:text-link-hover"
              >
                Privacy Policy →
              </a>
              <a
                href="https://www.iubenda.com/privacy-policy/47702140/cookie-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-link hover:text-link-hover"
              >
                Cookie Policy →
              </a>
              <Link
                href="/contatti"
                className="font-medium text-link hover:text-link-hover"
              >
                Contatti →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
