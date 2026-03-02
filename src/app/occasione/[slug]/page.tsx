// src/app/occasione/[slug]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const bgStyle = {
  backgroundImage:
    "radial-gradient(circle at 10px 10px, rgba(34,197,94,0.35) 1px, transparent 1px)," +
    "radial-gradient(circle at 28px 18px, rgba(244,63,94,0.25) 1px, transparent 1px)",
  backgroundSize: "40px 34px",
};

export default async function OccasionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: slugParam } = await params;
  const slug = String(slugParam ?? "").trim().toLowerCase();
  if (!slug || slug !== "pasqua") return notFound();

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-r from-emerald-50/70 via-[#FFF7EE]/80 to-rose-50/70 p-6 sm:p-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.10]"
          style={bgStyle}
        />

        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/60 bg-white/70 px-3 py-1 text-xs font-extrabold text-emerald-900">
            <span aria-hidden="true">🐣</span>
            <span>Speciale Pasqua</span>
            <span className="ml-1 rounded-full bg-[#C9A44C] px-2 py-0.5 text-[10px] font-extrabold text-white">
              Limited
            </span>
          </div>

          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#2B1B14] sm:text-4xl">
            Pasqua &quot;premium cioccolato&quot;
          </h1>

          <p className="mt-2 max-w-2xl text-sm font-semibold text-[#2B1B14]/70">
            Uova, ovetti e coniglietti di cioccolato: selezione premium. Marchi:{" "}
            <span className="font-extrabold">Caffarel</span>,{" "}
            <span className="font-extrabold">Lindt</span>,{" "}
            <span className="font-extrabold">Venchi</span>,{" "}
            <span className="font-extrabold">Perugina</span>.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
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

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Link
              href={`/catalogo?q=${encodeURIComponent("uova di pasqua")}`}
              className="rounded-2xl border border-border bg-white/80 p-4 hover:bg-white"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-200/60" aria-hidden="true">
                  🥚
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold text-[#2B1B14]">Uova di Pasqua</div>
                  <div className="text-xs font-semibold text-[#2B1B14]/65">classiche &amp; premium</div>
                </div>
              </div>
            </Link>

            <Link
              href={`/catalogo?q=${encodeURIComponent("coniglietto cioccolato")}`}
              className="rounded-2xl border border-border bg-white/80 p-4 hover:bg-white"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-rose-200/60" aria-hidden="true">
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
              className="rounded-2xl border border-border bg-white/80 p-4 hover:bg-white"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-200/60" aria-hidden="true">
                  🍫
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold text-[#2B1B14]">Ovetti &amp; mini</div>
                  <div className="text-xs font-semibold text-[#2B1B14]/65">assaggi &amp; mix</div>
                </div>
              </div>
            </Link>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={`/catalogo?q=${encodeURIComponent("pasqua")}`}
              className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover transition"
            >
              Vai alla selezione Pasqua
            </Link>

            <Link
              href="/catalogo"
              className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background px-6 text-sm font-extrabold hover:bg-surface-2"
            >
              Vedi tutto il catalogo
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
