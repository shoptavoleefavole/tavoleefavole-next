import Container from "@/components/Container";

export default function Topbar() {
  return (
    <div className="border-b border-border bg-primary/10">
      <Container>
        <div className="py-2 text-sm text-muted-text">
          {/* MOBILE: 2 righe centrate */}
          <div className="md:hidden flex flex-col items-center justify-center gap-1 text-center leading-snug">
            {/* Riga 1: Assistenza + Orari (compattati) */}
            <div className="px-2">
              <span className="font-semibold text-text">Assistenza:</span>{" "}
              <a className="text-link hover:text-link-hover" href="tel:+393482483901">
                +39 348 2483901
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

            {/* Riga 2: Mail + Spedizione */}
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-2">
              <a className="text-link hover:text-link-hover" href="mailto:support@example.com">
                support@example.com
              </a>

              <span className="rounded-full bg-background/70 px-3 py-1 text-xs text-text">
                Spedizione gratuita sopra 79€
              </span>
            </div>
          </div>

          {/* DESKTOP: centrato + pill a destra (come prima, più ordinato) */}
          <div className="hidden md:flex items-center justify-between gap-4">
            {/* Spacer sinistro per mantenere centratura ottica */}
            <div className="w-48" />

            <div className="flex flex-1 flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center">
              <span>
                Assistenza:{" "}
                <a className="text-link hover:text-link-hover" href="tel:+393482483901">
                  +39 348 2483901
                </a>
              </span>

              <span>
                Orari: 09:00/12:45 - 16:30/20:00 (Giovedì pomeriggio{" "}
                <strong className="text-text">CHIUSO</strong>)
              </span>

              <a className="text-link hover:text-link-hover" href="mailto:support@example.com">
                support@example.com
              </a>
            </div>

            <div className="w-48 flex justify-end">
              <span className="rounded-full bg-background/70 px-3 py-1 text-xs text-text">
                Spedizione gratuita sopra 79€
              </span>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
