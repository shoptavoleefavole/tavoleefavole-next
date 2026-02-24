import Link from "next/link";
export const dynamic = "force-dynamic";

function romeYMD() {
  // YYYY-MM-DD in Europe/Rome
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

// ✅ visibile solo fino al 10 Aprile (incluso)
function isEasterWindowActive() {
  const today = romeYMD();
  const year = today.slice(0, 4);

  const start = `${year}-02-01`;
  const end = `${year}-04-10`;

  return today >= start && today <= end;
}

export default function EasterStrip() {
  if (!isEasterWindowActive()) return null;

  return (
    <section
      className={[
        // ✅ FULL-WIDTH anche se inserita dentro un container
        "relative w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]",
        "border-b border-border",
        // tema premium pasqua
        "bg-gradient-to-r from-emerald-50/70 via-[#FFF7EE]/80 to-rose-50/70",
      ].join(" ")}
    >
      {/* pattern leggero (ovetti/confetti) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 10px 10px, rgba(34,197,94,0.35) 1px, transparent 1px)," +
            "radial-gradient(circle at 28px 18px, rgba(244,63,94,0.25) 1px, transparent 1px)",
          backgroundSize: "40px 34px",
        }}
      />

      {/* decorazioni “eleganti” (uovo / coniglietto) */}
      <div aria-hidden="true" className="pointer-events-none absolute right-6 top-1/2 hidden -translate-y-1/2 lg:block">
        <svg width="220" height="120" viewBox="0 0 220 120" fill="none">
          <path
            d="M78 14c18 0 33 22 33 46 0 28-16 46-33 46s-33-18-33-46c0-24 15-46 33-46Z"
            fill="rgba(201,164,76,0.25)"
          />
          <path
            d="M148 22c14 0 26 18 26 38 0 23-13 38-26 38s-26-15-26-38c0-20 12-38 26-38Z"
            fill="rgba(34,197,94,0.18)"
          />
          <path
            d="M196 60c0 16-10 30-23 30-13 0-23-14-23-30s10-30 23-30c13 0 23 14 23 30Z"
            fill="rgba(244,63,94,0.12)"
          />
          {/* bunny silhouette minimal */}
          <path
            d="M202 98c-8 0-14-5-14-12 0-5 3-9 8-11-2-4-1-10 2-14 4-5 9-5 12-2 2-5 6-8 10-8 5 0 8 4 7 9-1 4-4 8-7 10 4 2 6 6 6 10 0 10-10 18-24 18Z"
            fill="rgba(43,27,20,0.08)"
          />
        </svg>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* copy */}
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/60 bg-white/70 px-3 py-1 text-xs font-extrabold text-emerald-900">
              <span aria-hidden="true">🐣</span>
              <span>Speciale Pasqua</span>
              <span className="ml-1 rounded-full bg-[#C9A44C] px-2 py-0.5 text-[10px] font-extrabold text-white">
                Limited
              </span>
            </div>

            <h2 className="mt-2 text-lg font-extrabold tracking-tight text-[#2B1B14] md:text-xl">
              Uova, ovetti e coniglietti: Pasqua “premium cioccolato”
            </h2>

            <p className="mt-1 text-sm font-semibold text-[#2B1B14]/70">
              Selezione marchi:{" "}
              <span className="font-extrabold">Caffarel</span>,{" "}
              <span className="font-extrabold">Lindt</span>,{" "}
              <span className="font-extrabold">Venchi</span>,{" "}
              <span className="font-extrabold">Perugina</span>
            </p>

            {/* brand quick links */}
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

          {/* cards + CTA */}
          <div className="flex w-full flex-col gap-3 lg:w-[540px]">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Link
                href={`/catalogo?q=${encodeURIComponent("uova di pasqua")}`}
                className="rounded-2xl border border-border bg-white/80 p-3 hover:bg-white"
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
                className="rounded-2xl border border-border bg-white/80 p-3 hover:bg-white"
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
                className="rounded-2xl border border-border bg-white/80 p-3 hover:bg-white"
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
                ⏱️ Si disattiva automaticamente dopo il <span className="font-extrabold">10 Aprile</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}