"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import CialdeExamplesCarousel from "@/components/cialde/CialdeExamplesCarousel";

const WHATSAPP_NUMBER = "393482483901";
function waUrl(text: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

const CIALDE_PAGE_HREF = "/cialde-personalizzate";
const BISCOTTI_PAGE_HREF = "/stampe-biscotti-personalizzate";

// cambia qui la velocità (ms)
const ROTATE_MS = 5500;

type Slide = "cialde" | "biscotti";

export default function PersonalizedPrintsCarousel() {
  const [active, setActive] = useState<Slide>("cialde");

  // auto-rotate
  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((prev) => (prev === "cialde" ? "biscotti" : "cialde"));
    }, ROTATE_MS);

    return () => window.clearInterval(id);
  }, []);

  const isCialde = active === "cialde";

  const header = useMemo(() => {
    return isCialde
      ? {
          pill: "Stampe personalizzate • Per torte",
          title: "Cialde personalizzate per la tua torta",
          desc: "Carica un’immagine, scrivi una dedica e completa l’ordine in pochi minuti.",
          steps: [
            { n: "1", t: "Scegli formato" },
            { n: "2", t: "Scrivi la dedica" },
            { n: "3", t: "Carica l’immagine" },
          ],
          primaryHref: CIALDE_PAGE_HREF,
          primaryLabel: "Personalizza ora",
          waText: "Ciao! Vorrei info sulle cialde personalizzate 😊",
          micro: "Stampa nitida e colori brillanti. Consegna a casa o ritiro in negozio.",
        }
      : {
          pill: "Stampe personalizzate • Per biscotti",
          title: "Stampe per biscotti su foglio A4",
          desc: "Stampe tonde da ritagliare (4,5 · 5 · 6 cm). Perfette per biscotti.",
          steps: [
            { n: "1", t: "Scegli la dimensione" },
            { n: "2", t: "Carica immagine e testo" },
            { n: "3", t: "Ricevi o ritira" },
          ],
          primaryHref: BISCOTTI_PAGE_HREF,
          primaryLabel: "Personalizza biscotti",
          waText: "Ciao! Vorrei info sulle stampe per biscotti su foglio A4 😊",
          micro: "Foglio A4 con stampe da ritagliare. Consegna a casa o ritiro in negozio.",
        };
  }, [isCialde]);

  return (
    <section className="mt-10">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-background">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-surface-2/70 blur-3xl" />
          <div className="absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-surface-2/70 blur-3xl" />
        </div>

        <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-12 lg:items-center">
          {/* LEFT */}
          <div className="lg:col-span-6">
            {/* Tabs (cliccabili) */}
            <div className="inline-flex rounded-2xl border border-border bg-background p-1">
              <button
                type="button"
                onClick={() => setActive("cialde")}
                className={`h-9 rounded-xl px-4 text-xs font-extrabold transition ${
                  active === "cialde" ? "bg-primary text-primary-contrast" : "hover:bg-surface-2"
                }`}
                aria-pressed={active === "cialde"}
              >
                Per torte
              </button>
              <button
                type="button"
                onClick={() => setActive("biscotti")}
                className={`h-9 rounded-xl px-4 text-xs font-extrabold transition ${
                  active === "biscotti" ? "bg-primary text-primary-contrast" : "hover:bg-surface-2"
                }`}
                aria-pressed={active === "biscotti"}
              >
                Per biscotti
              </button>
            </div>

            <p className="mt-4 inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-xs font-extrabold text-text/70">
              {header.pill}
            </p>

            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {header.title}
            </h2>

            <p className="mt-3 max-w-xl text-sm leading-6 text-text/70 sm:text-base">
              {header.desc}
            </p>

            <div className="mt-6">
              <div className="text-sm font-extrabold">Come funziona</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {header.steps.map((x) => (
                  <div key={x.n} className="rounded-2xl border border-border bg-surface p-4">
                    <div className="text-xs font-extrabold text-text/70">Step {x.n}</div>
                    <div className="mt-1 text-sm font-extrabold">{x.t}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href={header.primaryHref}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover"
              >
                {header.primaryLabel}
              </Link>

              <a
                href={waUrl(header.waText)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background px-5 text-sm font-extrabold hover:bg-surface-2"
              >
                WhatsApp
              </a>
            </div>

            <p className="mt-3 text-xs text-text/70">{header.micro}</p>

            {/* dots */}
            <div className="mt-4 flex items-center gap-2 text-xs text-text/60">
              <span className={`h-2 w-2 rounded-full ${active === "cialde" ? "bg-primary" : "bg-border"}`} />
              <span className={`h-2 w-2 rounded-full ${active === "biscotti" ? "bg-primary" : "bg-border"}`} />
              <span className="ml-1">{active === "cialde" ? "1/2" : "2/2"}</span>
            </div>
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-6">
            {isCialde ? (
              <CialdeExamplesCarousel />
            ) : (
              <div className="overflow-hidden rounded-3xl border border-border bg-background">
                <div className="relative aspect-[16/11] bg-surface">
                  <Image
                    src="https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&w=1600&q=70"
                    alt="Esempio biscotti decorati"
                    fill
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    className="object-cover"
                    unoptimized
                  />
                </div>

                <div className="grid gap-2 p-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-surface p-4">
                    <div className="text-xs font-extrabold text-text/70">Formati</div>
                    <div className="mt-1 text-sm font-extrabold">4,5 · 5 · 6 cm</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-surface p-4">
                    <div className="text-xs font-extrabold text-text/70">Consiglio</div>
                    <div className="mt-1 text-sm font-extrabold">30 sec in freezer per staccare meglio</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
