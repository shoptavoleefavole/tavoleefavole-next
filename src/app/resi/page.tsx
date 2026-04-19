import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Resi e rimborsi",
};

export default function ResiPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header>
        <h1 className="text-3xl font-semibold">Resi e rimborsi</h1>
        <p className="mt-3 text-base leading-7 text-text/70">
          Tavole e Favole dedica la massima attenzione alla qualità dei prodotti
          e alla corretta gestione delle spedizioni.
        </p>
      </header>

      <div className="mt-8 space-y-8 text-base leading-7">
        <section className="space-y-4">
          <p>
            Poiché il sito vende prodotti alimentari, le richieste di reso,
            rimborso, sostituzione o reclamo vengono valutate in base al tipo di
            prodotto acquistato e alle condizioni in cui è stato ricevuto.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Diritto di recesso</h2>
          <p>
            Il diritto di recesso è riconosciuto al Cliente Consumatore nei casi
            previsti dalla legge.
          </p>
          <p>
            Per i prodotti non personalizzati, non aperti e non manomessi, il
            Cliente Consumatore può esercitare il diritto di recesso entro 14
            giorni dal ricevimento dei beni, inviando una comunicazione ai
            recapiti indicati in questa pagina.
          </p>
          <p>
            Per poter essere restituiti, i prodotti devono essere integri, non
            utilizzati, non aperti, non manomessi e completi della confezione
            originale, se presente. Le spese di restituzione sono a carico
            dell&apos;acquirente.
          </p>
          <div className="rounded-3xl border border-border bg-background p-6">
            <h3 className="text-lg font-semibold">Indirizzo per il reso</h3>
            <p className="mt-3 text-text/80">
              Tavole e Favole
              <br />
              Via Don Alessandro Niccoli, 35 A
              <br />
              73041 Carmiano (LE)
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Prodotti esclusi dal recesso</h2>
          <p>
            Il diritto di recesso non si applica ai prodotti personalizzati e ai
            prodotti sigillati che, una volta aperti, non possono essere
            restituiti per motivi igienici o legati alla tutela della salute.
          </p>
          <p>Rientrano tra i prodotti personalizzati, a titolo esemplificativo:</p>
          <ul className="list-disc space-y-2 pl-5 text-text/80">
            <li>box regalo personalizzate;</li>
            <li>dediche;</li>
            <li>composizioni su richiesta;</li>
            <li>stampa di cialde per torte.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Rimborso</h2>
          <p>
            Se il reso rispetta le condizioni previste, il rimborso viene
            effettuato con lo stesso metodo di pagamento usato per l&apos;acquisto,
            salvo diverso accordo con il cliente.
          </p>
          <p>
            Se necessario, Tavole e Favole può attendere il rientro della merce
            oppure la prova della spedizione prima di procedere al rimborso.
          </p>
          <p>
            Una volta chiusa la pratica, il rimborso viene disposto entro 5
            giorni.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">
            Prodotti danneggiati, deteriorati, errati o non conformi
          </h2>
          <p>
            Se alla consegna il collo risulta parzialmente o totalmente
            danneggiato, il cliente è invitato a ritirarlo con riserva di
            controllo, chiedendo al corriere di annotarlo.
          </p>
          <p>
            In caso di prodotto danneggiato, deteriorato, errato o non conforme,
            il cliente deve contattare l&apos;assistenza entro 2 giorni dalla
            ricezione, inviando fotografie del pacco, dell&apos;imballo,
            dell&apos;etichetta di spedizione e del prodotto ricevuto.
          </p>
          <p>
            La richiesta verrà presa in carico dal servizio clienti, che fornirà
            le indicazioni necessarie per la gestione della pratica. Per
            consentire le verifiche, i prodotti non devono essere manomessi
            oltre quanto necessario ad accertare il problema segnalato.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Gestione della pratica</h2>
          <p>
            Le segnalazioni vengono esaminate dal servizio clienti. I tempi medi
            di gestione sono di circa 1 settimana dalla ricezione di tutta la
            documentazione necessaria.
          </p>
          <p>
            Dopo le verifiche, Tavole e Favole potrà procedere, a seconda del
            caso, con:
          </p>
          <ul className="list-disc space-y-2 pl-5 text-text/80">
            <li>sostituzione del prodotto;</li>
            <li>rimborso totale o parziale;</li>
            <li>rimborso delle spese di spedizione, quando dovuto;</li>
            <li>emissione di un buono acquisto, previo accordo con il cliente;</li>
            <li>altra soluzione concordata con il cliente.</li>
          </ul>
          <p>
            Se il cartone risulta totalmente distrutto o schiacciato, Tavole e
            Favole valuterà il rimborso delle spese di spedizione e/o
            l&apos;emissione di un buono acquisto, oltre agli eventuali rimedi
            previsti per i casi di prodotto danneggiato o non conforme.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Contatti</h2>
          <p>
            Per richieste relative a resi, rimborsi, sostituzioni o reclami, il
            cliente può contattare Tavole e Favole ai seguenti recapiti:
          </p>
          <div className="space-y-1 text-text/80">
            <p>Email: shoptavoleefavole@gmail.com</p>
            <p>PEC: tavoleefavole@pec.it</p>
            <p>Telefono / WhatsApp: 3482783901</p>
          </div>
        </section>
      </div>
    </main>
  );
}
