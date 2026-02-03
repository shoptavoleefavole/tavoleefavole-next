import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contatti",
};

export default function ContattiPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Contatti</h1>

      <div className="mt-6 space-y-4 text-base leading-7">
        <p>
          Per informazioni su ordini, spedizioni, resi o prodotti puoi contattarci qui:
        </p>

        <ul className="list-disc pl-5">
          <li>
            Email: <a className="underline" href="mailto:support@example.com">support@example.com</a>
          </li>
          <li>Telefono/WhatsApp: +39 XXX XXX XXXX</li>
          <li>Orari: Lun–Ven 09:00–12:45 / 16:30–20:00 (Gio pom. chiuso)</li>
        </ul>

        <p className="text-sm opacity-80">
          Nota: sostituisci i dati sopra con quelli reali (email/telefono/orari).
        </p>
      </div>
    </main>
  );
}
