export const metadata = { title: "Supporto" };

export default function SupportoPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 pb-24 md:pb-8">
      <h1 className="text-2xl font-extrabold">Supporto</h1>
      <p className="mt-2 text-sm text-text/70">
        Per assistenza su ordini, spedizioni e prodotti, contattaci.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-background p-5">
          <div className="text-sm font-extrabold">Email</div>
          <div className="mt-1 text-sm text-text/70">assistenza@tavoleefavole.it</div>
        </div>

        <div className="rounded-2xl border border-border bg-background p-5">
          <div className="text-sm font-extrabold">Orari</div>
          <div className="mt-1 text-sm text-text/70">Lun–Ven 9:00–18:00</div>
        </div>
      </div>
    </main>
  );
}
