import Container from "@/components/Container";

/**
 * Topbar robusta:
 * - Niente support@example.com
 * - Email configurabile via env (se non c’è, non la mostra)
 * - Soglia spedizione configurabile via env
 */

const SUPPORT_PHONE_TEL = "+393482783901";
const SUPPORT_PHONE_LABEL = "+39 348 2483901";

// Se vuoi mostrarla, metti in .env.local:
// NEXT_PUBLIC_SUPPORT_EMAIL=la-tua-email@dominio.it
const SUPPORT_EMAIL = String(process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "").trim();

const FREE_SHIPPING_THRESHOLD_RAW = Number(process.env.NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD ?? 79);
const FREE_SHIPPING_THRESHOLD_EUR =
  Number.isFinite(FREE_SHIPPING_THRESHOLD_RAW) && FREE_SHIPPING_THRESHOLD_RAW > 0
    ? Math.round(FREE_SHIPPING_THRESHOLD_RAW)
    : 79;

export default function Topbar() {
  return (
    <div className="border-b border-border bg-primary/10">
      <Container>
        <div className="py-2 text-sm text-muted-text">
          {/* MOBILE */}
          <div className="md:hidden flex flex-col items-center justify-center gap-1 text-center leading-snug">
            <div className="px-2">
              <span className="font-semibold text-text">Assistenza:</span>{" "}
              <a
                className="text-link hover:text-link-hover"
                href={`tel:${SUPPORT_PHONE_TEL}`}
                aria-label={`Chiama ${SUPPORT_PHONE_LABEL}`}
              >
                {SUPPORT_PHONE_LABEL}
              </a>
              <span className="mx-2 opacity-60">•</span>
              <span className="font-semibold text-text">Orari:</span>{" "}
              <span className="whitespace-nowrap">09:00–12:45</span>{" "}
              <span className="opacity-60">/</span>{" "}
              <span className="whitespace-nowrap">16:30–20:00</span>{" "}
              <span className="whitespace-nowrap">
                (Gio. p.m. <span className="font-bold text-text">CHIUSO</span>)
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-2">
              {SUPPORT_EMAIL ? (
                <a className="text-link hover:text-link-hover" href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
              ) : null}

              <span className="rounded-full bg-background/70 px-3 py-1 text-xs text-text">
                Spedizione gratuita sopra {FREE_SHIPPING_THRESHOLD_EUR}€
              </span>
            </div>
          </div>

          {/* DESKTOP */}
          <div className="hidden md:flex items-center justify-between gap-4">
            <div className="w-48" />

            <div className="flex flex-1 flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center">
              <span>
                Assistenza:{" "}
                <a
                  className="text-link hover:text-link-hover"
                  href={`tel:${SUPPORT_PHONE_TEL}`}
                  aria-label={`Chiama ${SUPPORT_PHONE_LABEL}`}
                >
                  {SUPPORT_PHONE_LABEL}
                </a>
              </span>

              <span>
                Orari: 09:00/12:45 - 16:30/20:00 (Giovedì pomeriggio <strong className="text-text">CHIUSO</strong>)
              </span>

              {SUPPORT_EMAIL ? (
                <a className="text-link hover:text-link-hover" href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
              ) : null}
            </div>

            <div className="w-48 flex justify-end">
              <span className="rounded-full bg-background/70 px-3 py-1 text-xs text-text">
                Spedizione gratuita sopra {FREE_SHIPPING_THRESHOLD_EUR}€
              </span>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
