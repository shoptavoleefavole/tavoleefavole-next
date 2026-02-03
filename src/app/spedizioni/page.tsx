import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Spedizioni",
};

export default function SpedizioniPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Spedizioni</h1>

      <div className="mt-6 space-y-4 text-base leading-7">
        <p>
          Prepariamo gli ordini nel più breve tempo possibile. I tempi di consegna dipendono
          dal corriere e dalla destinazione.
        </p>
        <ul className="list-disc pl-5">
          <li>Riceverai una conferma ordine via email.</li>
          <li>Quando il pacco parte, riceverai (se disponibile) il tracking.</li>
          <li>Per problemi di consegna contatta l’assistenza con numero ordine.</li>
        </ul>
        <p className="text-sm opacity-80">
          (Aggiorniamo questo testo quando mi dici corriere, costi e soglia spedizione gratuita.)
        </p>
      </div>
    </main>
  );
}
