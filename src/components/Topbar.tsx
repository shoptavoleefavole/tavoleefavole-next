import Container from "@/components/Container";

/**
 * Topbar robusta:
 * - Niente support@example.com
 * - Email configurabile via env (se non c’è, non la mostra)
 * - Soglia spedizione configurabile via env
 */

const SUPPORT_PHONE_TEL = "+393482783901";
const SUPPORT_PHONE_LABEL = "+39 348 2783901";

// Se vuoi mostrarla, metti in .env.local:
// NEXT_PUBLIC_SUPPORT_EMAIL=la-tua-email@dominio.it
const SUPPORT_EMAIL = String(process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "").trim();

const FREE_SHIPPING_THRESHOLD_RAW = Number(process.env.NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD ?? 79);
const FREE_SHIPPING_THRESHOLD_EUR =
  Number.isFinite(FREE_SHIPPING_THRESHOLD_RAW) && FREE_SHIPPING_THRESHOLD_RAW > 0
    ? Math.round(FREE_SHIPPING_THRESHOLD_RAW)
    : 79;

const IS_CHRISTMAS =
  String(process.env.NEXT_PUBLIC_SITE_THEME ?? "").trim().toLowerCase() === "christmas";

export default function Topbar() {
  return (
    <div className="border-b border-border bg-primary/10">
      <Container>
        <div className="py-1.5 md:py-2 text-xs md:text-sm text-muted-text">
          {/* MOBILE */}
          <div className="md:hidden flex flex-col items-center justify-center gap-1.5 text-center leading-tight">
            {IS_CHRISTMAS ? (
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-background/90 px-2.5 py-0.5 text-[11px] font-extrabold text-primary shadow-sm">
                  <span aria-hidden="true">🎄</span>
                  <span>Speciale Natale</span>
                </span>
                <span className="rounded-full bg-background/80 px-2.5 py-0.5 text-[11px] font-semibold text-text">
                  Spedizione gratuita &gt; {FREE_SHIPPING_THRESHOLD_EUR}€
                </span>
              </div>
            ) : (
              <span className="rounded-full bg-background/80 px-3 py-0.5 text-[11px] font-semibold text-text">
                Spedizione gratuita sopra {FREE_SHIPPING_THRESHOLD_EUR}€
              </span>
            )}

            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-1 text-[11px]">
              <span>
                <span className="font-semibold text-text">Tel:</span>{" "}
                <a
                  className="font-semibold text-link hover:text-link-hover"
                  href={`tel:${SUPPORT_PHONE_TEL}`}
                  aria-label={`Chiama ${SUPPORT_PHONE_LABEL}`}
                >
                  {SUPPORT_PHONE_LABEL}
                </a>
              </span>

              <span className="opacity-50">•</span>

              <span className="whitespace-nowrap">
                09:00–12:45 / 16:30–20:00 (Gio. p.m. <strong className="text-text">CHIUSO</strong>)
              </span>

              {SUPPORT_EMAIL ? (
                <>
                  <span className="opacity-50">•</span>
                  <a className="text-link hover:text-link-hover" href={`mailto:${SUPPORT_EMAIL}`}>
                    {SUPPORT_EMAIL}
                  </a>
                </>
              ) : null}
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

              {IS_CHRISTMAS ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-background/85 px-3 py-0.5 text-xs font-extrabold text-primary">
                  <span aria-hidden="true">🎄</span>
                  <span>Speciale Natale • Dolcezze &amp; Idee Regalo</span>
                </span>
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