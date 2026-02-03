import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Resi",
};

export default function ResiPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Resi</h1>

      <div className="mt-6 space-y-4 text-base leading-7">
        <p>
          Se vuoi effettuare un reso, contatta l’assistenza indicando numero ordine e motivo.
        </p>
        <p>
          Ti risponderemo con le istruzioni di rientro (indirizzo, tempi e modalità).
        </p>
        <ul className="list-disc pl-5">
          <li>Il prodotto deve rientrare integro e ben imballato.</li>
          <li>Conserva la prova di spedizione del reso.</li>
          <li>Eventuali eccezioni dipendono dalla tipologia di prodotto.</li>
        </ul>
        <p className="text-sm opacity-80">
          (Testo base: se vuoi, lo rendiamo “definitivo” in base alle tue regole di reso.)
        </p>
      </div>
    </main>
  );
}
