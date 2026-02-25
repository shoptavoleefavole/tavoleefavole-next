// src/app/stampe-biscotti-personalizzate/page.tsx
"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import Image from "next/image";

import AddToCartButton from "@/components/cart/AddToCartButton";

const WHATSAPP_NUMBER = "393482783901";
function waUrl(text: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const UNIT_PRICE = 9;

const SIZES = [
  { cm: 4.5, label: "4,5 cm", perSheet: 24 },
  { cm: 5, label: "5 cm", perSheet: 15 },
  { cm: 6, label: "6 cm", perSheet: 12 },
] as const;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeText(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function makeId(sizeCm: number, text: string, qty: number) {
  // id stabile (evita conflitti in carrello) ma diverso al cambiare dei dati principali
  const t = safeText(text).slice(0, 40);
  const base = `${sizeCm}-${qty}-${t}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  return `biscotti-a4-${sizeCm}-${hash}`;
}

export default function StampeBiscottiPage() {
  const [sizeCm, setSizeCm] = useState<number>(5);
  const [text, setText] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [qty, setQty] = useState<number>(1);

  const sizeInfo = useMemo(() => SIZES.find((s) => s.cm === sizeCm) ?? SIZES[1], [sizeCm]);
  const cleanText = useMemo(() => safeText(text), [text]);
  const total = useMemo(() => UNIT_PRICE * qty, [qty]);

  const cartId = useMemo(() => makeId(sizeInfo.cm, cleanText, qty), [sizeInfo.cm, cleanText, qty]);

  // slug “logico” per carrello (non è lo slug Strapi prodotto)
  const cartSlug = "stampe-biscotti-personalizzate";

  const productName = useMemo(() => {
    const t = cleanText ? ` — "${cleanText}"` : "";
    const f = file?.name ? ` — ${file.name}` : "";
    return `Stampe biscotti personalizzate ${sizeInfo.label}${t}${f}`;
  }, [cleanText, file?.name, sizeInfo.label]);

  const demoImg =
    "https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&w=1600&q=70";

  const whatsappMsg = useMemo(() => {
    return [
      "Ciao! Vorrei info/assistenza per le stampe biscotti su foglio 😊",
      `• Misura: ${sizeInfo.label} (≈ ${sizeInfo.perSheet} stampe per foglio)`,
      `• Quantità: ${qty}`,
      cleanText ? `• Frase: "${cleanText}"` : "• Frase: (da definire)",
      "Posso inviare qui l’immagine da stampare?",
    ].join("\n");
  }, [sizeInfo.label, sizeInfo.perSheet, qty, cleanText]);

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <section className="rounded-3xl border border-border bg-background p-6 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
          {/* LEFT */}
          <div className="lg:col-span-7">
            <p className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-xs font-extrabold text-text/70">
              Stampe personalizzate • Biscotti
            </p>

            <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Stampe per biscotti su foglio A4
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-text/70 sm:text-base">
              Scegli la misura (4,5 · 5 · 6 cm), scrivi la frase, carica l’immagine e seleziona la quantità.
              Ricevi a casa o ritira in negozio.
            </p>

            {/* quick pills */}
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-extrabold">
                € {UNIT_PRICE.toFixed(2)}
              </span>
              <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-extrabold">
                Foglio A4
              </span>
              <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-extrabold">
                Da ritagliare
              </span>
            </div>

            {/* feature cards */}
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { t: "Risultato wow", d: "Decorazione pulita e veloce" },
                { t: "Stampa nitida", d: "Colori brillanti" },
                { t: "Assistenza", d: "WhatsApp se hai dubbi" },
              ].map((x) => (
                <div key={x.t} className="rounded-2xl border border-border bg-surface p-4">
                  <div className="text-sm font-extrabold">{x.t}</div>
                  <div className="mt-1 text-xs text-text/70">{x.d}</div>
                </div>
              ))}
            </div>

            {/* STEPS */}
            <div className="mt-8 grid gap-6">
              {/* Step 1 */}
              <div className="rounded-3xl border border-border bg-background p-6">
                <div className="text-sm font-extrabold">1) Scegli la misura</div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {SIZES.map((s) => {
                    const active = s.cm === sizeInfo.cm;
                    return (
                      <button
                        key={s.cm}
                        type="button"
                        onClick={() => setSizeCm(s.cm)}
                        className={[
                          "rounded-2xl border p-4 text-left transition",
                          active
                            ? "border-primary bg-primary/5"
                            : "border-border bg-background hover:bg-surface-2",
                        ].join(" ")}
                      >
                        <div className="text-sm font-extrabold">{s.label}</div>
                        <div className="mt-1 text-xs text-text/70">
                          Circa {s.perSheet} stampe per foglio A4
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2 */}
              <div className="rounded-3xl border border-border bg-background p-6">
                <div className="text-sm font-extrabold">2) Cosa vuoi scrivere?</div>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Es. Buon Compleanno Emma"
                  className="mt-4 h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none"
                  maxLength={120}
                />
                <p className="mt-2 text-xs text-text/70">
                  Consiglio: massimo 120 caratteri per una stampa più leggibile.
                </p>
              </div>

              {/* Step 3 */}
              <div className="rounded-3xl border border-border bg-background p-6">
                <div className="text-sm font-extrabold">3) Carica l’immagine</div>

                <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm">
                      <div className="font-extrabold">Seleziona un file</div>
                      <div className="text-xs text-text/70">
                        JPG/PNG/WebP consigliati • max 10MB
                      </div>
                      <div className="mt-1 text-xs text-text/70">
                        {file?.name ? (
                          <>
                            File selezionato: <span className="font-semibold">{file.name}</span>
                          </>
                        ) : (
                          "Nessun file selezionato"
                        )}
                      </div>
                    </div>

                    <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-extrabold hover:bg-surface-2">
                      Sfoglia
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={onFileChange}
                      />
                    </label>
                  </div>
                </div>

                <p className="mt-2 text-xs text-text/70">
                  Carica solo immagini di cui possiedi i diritti o per cui hai autorizzazione all’uso.
                </p>
              </div>

              {/* Step 4 */}
              <div className="rounded-3xl border border-border bg-background p-6">
                <div className="text-sm font-extrabold">4) Quantità</div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQty((q) => clamp(q - 1, 1, 99))}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background text-lg font-extrabold hover:bg-surface-2"
                    aria-label="Diminuisci quantità"
                  >
                    −
                  </button>

                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={qty}
                    onChange={(e) => setQty(clamp(Number(e.target.value || 1), 1, 99))}
                    className="h-11 w-24 rounded-2xl border border-border bg-background px-4 text-sm font-extrabold outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => setQty((q) => clamp(q + 1, 1, 99))}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background text-lg font-extrabold hover:bg-surface-2"
                    aria-label="Aumenta quantità"
                  >
                    +
                  </button>

                  <div className="text-sm text-text/70">
                    Totale: <span className="font-extrabold">€ {total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <Link href="/cialde-personalizzate" className="text-sm font-semibold text-link hover:text-link-hover">
                Cerchi una cialda per torta? →
              </Link>
            </div>
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-3xl border border-border bg-background">
              <div className="relative aspect-[16/11] bg-surface">
                <Image
                  src={demoImg}
                  alt="Esempio biscotti decorati"
                  fill
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover"
                  unoptimized
                  priority
                />
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-border bg-background p-6">
              <div className="text-sm font-extrabold">Riepilogo</div>

              <div className="mt-4 rounded-2xl border border-border bg-surface p-4 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-extrabold">Stampe biscotti </div>
                  <div className="font-extrabold">€ {UNIT_PRICE.toFixed(2)}</div>
                </div>

                <div className="mt-2 text-xs text-text/70">
                  <div>Misura: {sizeInfo.label} (≈ {sizeInfo.perSheet} stampe/foglio)</div>
                  <div>Quantità: {qty}</div>
                  <div>Frase: {cleanText ? `"${cleanText}"` : "—"}</div>
                  <div>Immagine: {file?.name ? file.name : "Da caricare"}</div>
                </div>
              </div>

              <div className="mt-4">
                <AddToCartButton
                  id={cartId}
                  slug={cartSlug}
                  name={productName}
                  image={demoImg}
                  price={UNIT_PRICE}
                  qty={qty}
                  inStock={true}
                  disabledLabel="Non disponibile"
                />
                <p className="mt-2 text-xs text-text/70">
                  Hai dubbi su qualità immagine o impaginazione? Scrivici su WhatsApp e allega la foto.
                </p>
              </div>

              <div className="mt-3">
                <a
                  href={waUrl(whatsappMsg)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-border bg-background px-5 text-sm font-extrabold hover:bg-surface-2"
                >
                  WhatsApp
                </a>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-border bg-background p-6">
              <div className="text-sm font-extrabold">Consiglio pratico</div>
              <p className="mt-2 text-sm text-text/70">
                Per staccare meglio il supporto, metti la stampa in freezer per ~30 secondi prima di rimuovere la plastica.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
