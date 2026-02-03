export const metadata = {
  title: "Termini e condizioni | Tavole & Favole",
  description: "Termini e condizioni di vendita di Tavole & Favole.",
};

export default function Page() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Termini e condizioni</h1>

      <div className="prose prose-neutral mt-6 max-w-none">
        <p>
          In questa sezione trovi i termini e le condizioni di vendita.
          Per informazioni su privacy e cookie, consulta le pagine dedicate.
        </p>

        <p>
          Se vuoi, possiamo collegare qui anche un documento esterno (PDF o pagina dedicata).
          In alternativa, puoi gestire i documenti legali tramite il tuo servizio (es. Iubenda).
        </p>
      </div>
    </main>
  );
}
