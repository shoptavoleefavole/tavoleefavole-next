import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contatti",
};

const PHONE_DISPLAY = "+39 348 278 3901";
const PHONE_TEL = "+393482783901";
const EMAIL = "shoptavoleefavole@gmail.com";

const ADDRESS_LINE = "Via Don Alessandro Niccoli, 35A";
const ADDRESS_CITY = "Carmiano (LE), 73041";
const ADDRESS_FULL = `${ADDRESS_LINE}, ${ADDRESS_CITY}`;

const WHATSAPP_NUMBER = "393482783901";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Ciao Tavole & Favole! Ho bisogno di informazioni 🙂"
)}`;

const INSTAGRAM_URL = "https://www.instagram.com/tavoleefavole/";
const FACEBOOK_URL = "https://www.facebook.com/dolciumicarmiano/";

const MAP_EMBED_URL = `https://www.google.com/maps?q=${encodeURIComponent(
  ADDRESS_FULL
)}&output=embed`;

const MAP_OPEN_URL = `https://www.google.com/maps?q=${encodeURIComponent(ADDRESS_FULL)}`;

function Card(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <div className="text-sm font-extrabold">{props.title}</div>
      <div className="mt-2 text-sm text-text/70">{props.children}</div>
    </div>
  );
}

export default function ContattiPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      {/* Header */}
      <header className="max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight">Contatti</h1>
        <p className="mt-3 text-base leading-7 text-text/70">
          Siamo a disposizione per informazioni su prodotti, ordini, spedizioni e resi.
          Il modo più rapido è scriverci su WhatsApp.
        </p>
      </header>

      {/* CTA principali */}
      <section className="mt-6 flex flex-wrap gap-3">
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover"
        >
          Apri WhatsApp
        </a>

        <a
          href={`tel:${PHONE_TEL}`}
          className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background px-5 text-sm font-extrabold hover:bg-surface-2"
        >
          Chiama
        </a>

        <a
          href={`mailto:${EMAIL}`}
          className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background px-5 text-sm font-extrabold hover:bg-surface-2"
        >
          Invia email
        </a>
      </section>

      {/* Info cards */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="WhatsApp (consigliato)">
          <div className="font-semibold text-text">{PHONE_DISPLAY}</div>
          <div className="mt-1">Risposta rapida per info e supporto.</div>
          <div className="mt-3">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link hover:text-link-hover font-semibold"
            >
              Apri chat →
            </a>
          </div>
        </Card>

        <Card title="Telefono">
          <div className="font-semibold text-text">{PHONE_DISPLAY}</div>
          <div className="mt-1">Se preferisci parlare con noi.</div>
          <div className="mt-3">
            <a href={`tel:${PHONE_TEL}`} className="text-link hover:text-link-hover font-semibold">
              Chiama →
            </a>
          </div>
        </Card>

        <Card title="Email">
          <div className="font-semibold text-text">{EMAIL}</div>
          <div className="mt-1">Per richieste dettagliate o documenti.</div>
          <div className="mt-3">
            <a href={`mailto:${EMAIL}`} className="text-link hover:text-link-hover font-semibold">
              Scrivi →
            </a>
          </div>
        </Card>

        <Card title="Indirizzo">
          <div className="font-semibold text-text">{ADDRESS_LINE}</div>
          <div className="mt-1">{ADDRESS_CITY}</div>
          <div className="mt-3">
            <a
              href={MAP_OPEN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link hover:text-link-hover font-semibold"
            >
              Apri su Google Maps →
            </a>
          </div>
        </Card>
      </section>

      {/* Orari + Social */}
      <section className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1 rounded-3xl border border-border bg-surface p-6">
          <h2 className="text-lg font-extrabold">Orari</h2>

          <div className="mt-4 space-y-3 text-sm text-text/70">
            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="font-extrabold text-text">Lun – Sab</div>
              <div className="mt-1">09:00 – 12:45</div>
              <div>16:30 – 20:00</div>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="font-extrabold text-text">Giovedì pomeriggio</div>
              <div className="mt-1">Chiuso</div>
            </div>
          </div>

          <h3 className="mt-6 text-sm font-extrabold">Social</h3>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-border bg-background px-4 py-3 font-semibold text-link hover:text-link-hover hover:bg-surface-2"
            >
              Instagram →
            </a>
            <a
              href={FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-border bg-background px-4 py-3 font-semibold text-link hover:text-link-hover hover:bg-surface-2"
            >
              Facebook →
            </a>
          </div>

          <p className="mt-6 text-xs text-text/60">
            Per info su privacy e cookie visita{" "}
            <Link className="text-link hover:text-link-hover font-semibold" href="/privacy-policy">
              Privacy Policy
            </Link>{" "}
            e{" "}
            <Link className="text-link hover:text-link-hover font-semibold" href="/cookie-policy">
              Cookie Policy
            </Link>
            .
          </p>
        </div>

        {/* Mappa */}
        <div className="lg:col-span-2 overflow-hidden rounded-3xl border border-border bg-background">
          <div className="p-6">
            <h2 className="text-lg font-extrabold">Dove siamo</h2>
            <p className="mt-2 text-sm text-text/70">
              {ADDRESS_FULL}
            </p>
          </div>

          <div className="relative h-[360px] w-full border-t border-border">
            <iframe
              title="Mappa Tavole & Favole"
              src={MAP_EMBED_URL}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-full w-full"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 p-6">
            <a
              href={MAP_OPEN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-extrabold text-link hover:text-link-hover"
            >
              Apri su Google Maps →
            </a>

            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background px-5 text-sm font-extrabold hover:bg-surface-2"
            >
              Scrivici su WhatsApp
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
