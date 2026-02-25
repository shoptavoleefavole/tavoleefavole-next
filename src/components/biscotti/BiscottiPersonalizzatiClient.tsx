"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import AddToCartButton from "@/components/cart/AddToCartButton";

const WHATSAPP_NUMBER = "393482783901";
function waUrl(text: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

// ✅ Prodotto biscotti (unit price)
const PRODUCT = {
  id: "biscotti-a4-personalizzati",
  slug: "stampe-biscotti-personalizzate",
  name: "Stampe per biscotti (foglio A4) personalizzate",
  image:
    "https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&w=1600&q=70",
  unitPrice: 9.0, // ✅ prezzo fisso 9€
  inStock: true,
};

type Diameter = "4.5" | "5" | "6";

function slugify(s: string) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .slice(0, 60);
}

function clampInt(n: number, min: number, max: number) {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

export default function BiscottiPersonalizzatiClient() {
  const [diameter, setDiameter] = useState<Diameter>("5");
  const [dedica, setDedica] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [qty, setQty] = useState<number>(1);

  const unitPrice = PRODUCT.unitPrice;
  const totalPrice = useMemo(() => unitPrice * qty, [unitPrice, qty]);

  const formattedUnit = useMemo(() => `€ ${unitPrice.toFixed(2)}`, [unitPrice]);
  const formattedTotal = useMemo(() => `€ ${totalPrice.toFixed(2)}`, [totalPrice]);

  // ✅ id unico (evita che due personalizzazioni diverse si “fondano” nel carrello)
  const cartItemId = useMemo(() => {
    const d = slugify(dedica || "senza-dedica");
    const f = file?.name ? slugify(file.name) : "senza-immagine";
    return `${PRODUCT.id}:${diameter}:${d}:${f}`;
  }, [diameter, dedica, file]);

  const cartItemName = useMemo(() => {
    const d = dedica?.trim() ? ` • “${dedica.trim()}”` : "";
    const f = file?.name ? ` • img:${file.name}` : "";
    return `${PRODUCT.name} • Ø ${diameter} cm${d}${f}`;
  }, [diameter, dedica, file]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <section className="rounded-3xl border border-border bg-background p-6 sm:p-10">
        <div className="grid gap-10 lg:grid-cols-12">
          {/* LEFT */}
          <div className="lg:col-span-7">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Biscotti personalizzati (stampe su foglio A4)
            </h1>

            <p className="mt-2 text-sm text-text/70 sm:text-base">
              Scegli la misura, scrivi la dedica, carica l’immagine, scegli la quantità e aggiungi al carrello.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-background p-4">
                <div className="text-sm font-extrabold">Risultato wow</div>
                <div className="mt-1 text-xs text-text/70">Decorazione rapida e pulita</div>
              </div>
              <div className="rounded-2xl border border-border bg-background p-4">
                <div className="text-sm font-extrabold">Stampa nitida</div>
                <div className="mt-1 text-xs text-text/70">Colori brillanti e definiti</div>
              </div>
              <div className="rounded-2xl border border-border bg-background p-4">
                <div className="text-sm font-extrabold">Assistenza</div>
                <div className="mt-1 text-xs text-text/70">WhatsApp se hai dubbi</div>
              </div>
            </div>

            {/* STEP 1 */}
            <div className="mt-10 rounded-3xl border border-border bg-background p-6">
              <div className="text-sm font-extrabold">1) Scegli la misura</div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  { key: "4.5" as const, title: "Ø 4,5 cm", desc: "Tondi piccoli" },
                  { key: "5" as const, title: "Ø 5 cm", desc: "Formato standard" },
                  { key: "6" as const, title: "Ø 6 cm", desc: "Tondi grandi" },
                ].map((x) => (
                  <button
                    key={x.key}
                    type="button"
                    onClick={() => setDiameter(x.key)}
                    className={`text-left rounded-2xl border p-4 transition ${
                      diameter === x.key
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:bg-surface-2"
                    }`}
                  >
                    <div className="text-sm font-extrabold">{x.title}</div>
                    <div className="mt-1 text-xs text-text/70">{x.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* STEP 2 */}
            <div className="mt-6 rounded-3xl border border-border bg-background p-6">
              <div className="text-sm font-extrabold">2) Scrivi la frase</div>

              <input
                value={dedica}
                onChange={(e) => setDedica(e.target.value)}
                placeholder="Es. Buon compleanno!"
                className="mt-4 h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
              />
              <div className="mt-2 text-xs text-text/60">
                Consiglio: massimo 120 caratteri per una stampa più leggibile.
              </div>
            </div>

            {/* STEP 3 */}
            <div className="mt-6 rounded-3xl border border-border bg-background p-6">
              <div className="text-sm font-extrabold">3) Carica l’immagine</div>

              <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4">
                <div>
                  <div className="text-sm font-extrabold">Seleziona un file</div>
                  <div className="mt-1 text-xs text-text/70">
                    JPG/PNG/WebP consigliati • max 10MB
                    {file ? (
                      <span className="block mt-1">
                        File: <strong>{file.name}</strong>
                      </span>
                    ) : null}
                  </div>
                </div>

                <label className="cursor-pointer rounded-full border border-border bg-background px-4 py-2 text-sm font-extrabold hover:bg-surface-2">
                  Sfoglia
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              <div className="mt-3 text-xs text-text/60">
                Carica solo immagini di cui possiedi i diritti o per cui hai autorizzazione all’uso.
              </div>
            </div>

            {/* STEP 4 */}
            <div className="mt-6 rounded-3xl border border-border bg-background p-6">
              <div className="text-sm font-extrabold">4) Quantità</div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQty((q) => clampInt(q - 1, 1, 99))}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background text-lg font-extrabold hover:bg-surface-2"
                  aria-label="Diminuisci quantità"
                >
                  −
                </button>

                <input
                  type="number"
                  min={1}
                  max={99}
                  value={qty}
                  onChange={(e) => setQty(clampInt(e.target.valueAsNumber, 1, 99))}
                  className="h-11 w-24 rounded-xl border border-border bg-background px-3 text-sm font-extrabold outline-none focus:border-primary"
                />

                <button
                  type="button"
                  onClick={() => setQty((q) => clampInt(q + 1, 1, 99))}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background text-lg font-extrabold hover:bg-surface-2"
                  aria-label="Aumenta quantità"
                >
                  +
                </button>

                <div className="ml-auto text-sm text-text/70">
                  Prezzo unitario: <span className="font-extrabold text-text">{formattedUnit}</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-5">
            <div className="sticky top-6 space-y-4">
              <div className="rounded-3xl border border-border bg-background p-6">
                <div className="text-sm font-extrabold">Riepilogo</div>

                <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-extrabold">Stampe biscotti personalizzate</div>
                      <div className="mt-1 text-xs text-text/70">Foglio A4 (tondi)</div>
                    </div>
                    <div className="text-sm font-extrabold">{formattedUnit}</div>
                  </div>

                  <div className="mt-4 grid gap-2 text-xs text-text/70">
                    <div>
                      <span className="font-extrabold text-text">Misura</span>
                      <div>Ø {diameter} cm</div>
                    </div>

                    <div>
                      <span className="font-extrabold text-text">Frase</span>
                      <div>{dedica?.trim() ? `“${dedica.trim()}”` : "—"}</div>
                    </div>

                    <div>
                      <span className="font-extrabold text-text">Immagine</span>
                      <div>{file ? "Caricata" : "Da caricare"}</div>
                    </div>

                    <div>
                      <span className="font-extrabold text-text">Quantità</span>
                      <div>{qty}</div>
                    </div>

                    <div className="pt-2 border-t border-border flex items-center justify-between">
                      <span className="font-extrabold text-text">Totale</span>
                      <span className="font-extrabold text-text">{formattedTotal}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <AddToCartButton
                    id={cartItemId}
                    slug={PRODUCT.slug}
                    name={cartItemName}
                    image={PRODUCT.image}
                    price={PRODUCT.unitPrice}
                    qty={qty} // ✅ quantità scelta dal cliente
                    inStock={PRODUCT.inStock}
                    disabledLabel="Esaurito"
                  />
                </div>

                <a
                  href={waUrl("Ciao! Vorrei info sulle stampe per biscotti su foglio A4 😊")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-border bg-background px-4 py-3 text-sm font-extrabold hover:bg-surface-2"
                >
                  Hai dubbi? Scrivici su WhatsApp
                </a>

                <div className="mt-3 text-xs text-text/60">Spedizione a casa o ritiro in negozio.</div>
              </div>

              <div className="overflow-hidden rounded-3xl border border-border bg-background">
                <div className="relative aspect-[16/10]">
                  <Image
                    src={PRODUCT.image}
                    alt="Esempio biscotti decorati"
                    fill
                    sizes="(min-width: 1024px) 420px, 100vw"
                    className="object-cover"
                    unoptimized
                    priority
                  />
                </div>
              </div>

              <Link
                href="/catalogo"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-border bg-background px-4 py-3 text-sm font-extrabold hover:bg-surface-2"
              >
                Torna al catalogo
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
