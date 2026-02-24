import Link from "next/link";

function romeYMD() {
  // YYYY-MM-DD in Europe/Rome (evita problemi di timezone)
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// ✅ Mostra dal 1 Marzo al 10 Aprile (incluso). Dopo 10 Aprile sparisce da sola.
function isEasterWindowActive() {
  const today = romeYMD(); // YYYY-MM-DD
  const year = today.slice(0, 4);

  const start = `${year}-03-01`;
  const end = `${year}-04-10`;

  return today >= start && today <= end;
}

export default function EasterStrip() {
  if (!isEasterWindowActive()) return null;

  return (
    <section className="relative border-b border-border bg-emerald-50/60">
      {/* Pattern leggerissimo (uova/ovetti) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 10px 10px, rgba(34,197,94,0.35) 1px, transparent 1px)," +
            "radial-gradient(circle at 26px 18px, rgba(244,63,94,0.25) 1px, transparent 1px)",
          backgroundSize: "38px 32px",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: copy */}
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/60 bg-white/70 px-3 py-1 text-xs font-extrabold text-emerald-900">
              <span aria-hidden="true">🐣</span>
              <span>Speciale Pasqua</span>
              <span className="ml-1 rounded-full bg-[#C9A44C] px-2 py-0.5 text-[10px] font-extrabold text-white">
                Limited
              </span>
            </div>

            <h2 className="mt-2 text-lg font-extrabold tracking-tight text-[#2B1B14] md:text-xl">
              Uova, ovetti e coniglietti di cioccolato — selezione premium
            </h2>

            <p className="mt-1 text-sm font-semibold text-[#2B1B14]/70">
              Marchi disponibili:{" "}
              <span className="font-extrabold">Caffarel</span>,{" "}
              <span className="font-extrabold">Lindt</span>,{" "}
              <span className="font-extrabold">Venchi</span>,{" "}
              <span className="font-extrabold">Perugina</span>
            </p>

            {/* Brand quick links */}
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { label: "Caffarel", q: "caffarel" },
                { label: "Lindt", q: "lindt" },
                { label: "Venchi", q: "venchi" },
                { label: "Perugina", q: "perugina" },
              ].map((b) => (
                <Link
                  key={b.q}
                  href={`/catalogo?q=${encodeURIComponent(b.q)}`}
                  className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-extrabold text-text hover:bg-surface-2"
                >
                  {b.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Right: CTA + mini cards */}
          <div className="flex w-full flex-col gap-3 lg:w-[520px]">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Link
                href={`/catalogo?q=${encodeURIComponent("uova di pasqua")}`}
                className="group rounded-2xl border border-border bg-white/80 p-3 hover:bg-white"
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-200/60" aria-hidden="true">
                    🥚
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-extrabold text-[#2B1B14]">Uova di Pasqua</div>
                    <div className="text-xs font-semibold text-[#2B1B14]/65">classiche & premium</div>
                  </div>
                </div>
              </Link>

              <Link
                href={`/catalogo?q=${encodeURIComponent("coniglietto cioccolato")}`}
                className="group rounded-2xl border border-border bg-white/80 p-3 hover:bg-white"
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-200/60" aria-hidden="true">
                    🐰
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-extrabold text-[#2B1B14]">Coniglietti</div>
                    <div className="text-xs font-semibold text-[#2B1B14]/65">idee regalo</div>
                  </div>
                </div>
              </Link>

              <Link
                href={`/catalogo?q=${encodeURIComponent("ovetti cioccolato")}`}
                className="group rounded-2xl border border-border bg-white/80 p-3 hover:bg-white"
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-200/60" aria-hidden="true">
                    🍫
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-extrabold text-[#2B1B14]">Ovetti & mini</div>
                    <div className="text-xs font-semibold text-[#2B1B14]/65">assaggi & mix</div>
                  </div>
                </div>
              </Link>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href="/occasione/pasqua"
                className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover transition"
              >
                Scopri Pasqua
              </Link>

              <div className="text-xs font-semibold text-[#2B1B14]/70">
                ⏱️ La sezione si disattiva automaticamente dopo il <span className="font-extrabold">10 Aprile</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}