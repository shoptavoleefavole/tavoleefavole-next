import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chi siamo",
};

export default function ChiSiamoPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Chi siamo</h1>

      <div className="mt-6 space-y-4 text-base leading-7">
        <p>
          <strong>Tavole &amp; Favole</strong> nasce per portare qualità e cura nei
          dettagli in tutto ciò che ruota attorno alla pasticceria, al cake design e
          alle occasioni speciali.
        </p>
        <p>
          Selezioniamo prodotti affidabili, con attenzione a materiali, resa e praticità,
          con l’obiettivo di rendere più semplice trovare “quello giusto” per ogni
          preparazione.
        </p>
        <p>
          Il nostro impegno è offrire un’esperienza di acquisto chiara, veloce e trasparente:
          descrizioni complete, immagini curate e supporto quando serve.
        </p>
      </div>
    </main>
  );
}
