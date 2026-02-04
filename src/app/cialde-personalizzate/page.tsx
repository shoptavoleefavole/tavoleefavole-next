"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";

type Shape = "tonda" | "rettangolare" | "personalizzato";
type Material = "ostia" | "pasta_di_zucchero";

const PRICE: Record<Material, number> = {
  ostia: 4.75,
  pasta_di_zucchero: 6.5,
};

const MAX_FILE_MB = 10;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

// “prodotto virtuale” (non Strapi)
const CIALDE_CART_PRODUCT = {
  id: "cialda-personalizzata",
  slug: "cialde-personalizzate",
  name: "Cialda personalizzata",
};

function eur(n: number) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "€ 0,00";
  return `€ ${num.toFixed(2).replace(".", ",")}`;
}

function safeTrim(s: unknown) {
  return String(s ?? "").trim();
}

function validateFile(file: File | null) {
  if (!file) return { ok: false as const, error: "Carica un’immagine per continuare." };
  if (!file.type?.startsWith("image/")) {
    return { ok: false as const, error: "Il file deve essere un’immagine (JPG/PNG/WebP)." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false as const, error: `Immagine troppo grande (max ${MAX_FILE_MB}MB).` };
  }
  return { ok: true as const, error: "" };
}

function isAbortError(e: unknown) {
  return typeof e === "object" && e !== null && (e as any)?.name === "AbortError";
}

export default function CialdePersonalizzatePage() {
  const router = useRouter();
  const { addItem } = useCart();

  const [shape, setShape] = useState<Shape>("tonda");
  const [material, setMaterial] = useState<Material>("ostia");

  // campo vuoto + placeholder (come richiesto)
  const [text, setText] = useState<string>("");

  // note solo per “personalizzato”
  const [notes, setNotes] = useState<string>("");

  const [file, setFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);

  const price = PRICE[material];

  const needsNotes = shape === "personalizzato";

  const shapeLabel = useMemo(() => {
    if (shape === "tonda") return "Tonda (diam. 19,8 cm)";
    if (shape === "rettangolare") return "Rettangolare (max 27,6 × 18,41 cm)";
    return "Formato personalizzato (da confermare)";
  }, [shape]);

  const materialLabel = useMemo(() => {
    return material === "ostia" ? "Ostia" : "Pasta di zucchero";
  }, [material]);

  const t = safeTrim(text);
  const n = safeTrim(notes);

  const canContinue = t.length > 0 && !!file && (!needsNotes || n.length > 0) && !busy;

  // se cambio shape e non è più personalizzato, pulisco le note
  useEffect(() => {
    if (shape !== "personalizzato") setNotes("");
  }, [shape]);

  // preview: creazione/revoca pulita quando cambia file
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    };
  }, [file]);

  // abort in unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function uploadToStrapi(selected: File) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const fd = new FormData();
      fd.append("files", selected);

      const res = await fetch("/api/cialde/upload", {
        method: "POST",
        body: fd,
        signal: controller.signal,
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          (json as any)?.error ||
          (json as any)?.message ||
          `Upload fallito (HTTP ${res.status})`;
        throw new Error(typeof msg === "string" ? msg : "Upload fallito.");
      }

      const url = (json as any)?.url;
      if (!url || typeof url !== "string") {
        throw new Error("Upload fallito: URL immagine mancante.");
      }

      return url as string;
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  async function handleAddToCart() {
    if (busyRef.current) return;
    setError(null);

    const tt = safeTrim(text);
    const nn = safeTrim(notes);

    if (!tt) {
      setError("Scrivi la dedica per continuare.");
      return;
    }

    if (needsNotes && !nn) {
      setError("Inserisci le note per il formato personalizzato (misure/richieste).");
      return;
    }

    const vf = validateFile(file);
    if (!vf.ok) {
      setError(vf.error);
      return;
    }

    try {
      busyRef.current = true;
      setBusy(true);

      const uploadedUrl = await uploadToStrapi(file!);

      const meta = {
        kind: "cialda-personalizzata",
        href: "/cialde-personalizzate",
        shape,
        material,
        text: tt,
        imageUrl: uploadedUrl,
        ...(needsNotes ? { notes: nn } : {}),
      };

      addItem(
        {
          id: CIALDE_CART_PRODUCT.id,
          slug: CIALDE_CART_PRODUCT.slug,
          name: CIALDE_CART_PRODUCT.name,
          image: uploadedUrl,
          price,
        } as any,
        1,
        meta,
        { inStock: true }
      );

      router.push("/carrello");
    } catch (e: any) {
      if (isAbortError(e)) return;
      setError(e?.message ? String(e.message) : "Errore durante l’aggiunta al carrello.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-text/70">
        <Link href="/" className="hover:underline">
          Home
        </Link>{" "}
        <span className="text-text/40">/</span> Cialde personalizzate
      </p>

      <div className="mt-4 grid gap-8 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-6">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Cialde personalizzate per torte
          </h1>
          <p className="mt-3 text-sm leading-6 text-text/70 sm:text-base">
            Scegli formato e materiale, scrivi la dedica, carica l’immagine e aggiungi al carrello.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-extrabold">
              Ostia da {eur(PRICE.ostia)}
            </span>
            <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-extrabold">
              Pasta di zucchero {eur(PRICE.pasta_di_zucchero)}
            </span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { t: "Risultato wow", d: "Personalizzazione immediata" },
              { t: "Stampa nitida", d: "Colori brillanti" },
              { t: "Assistenza", d: "WhatsApp se hai dubbi" },
            ].map((x) => (
              <div key={x.t} className="rounded-2xl border border-border bg-surface p-4">
                <div className="text-sm font-extrabold">{x.t}</div>
                <div className="mt-1 text-xs text-text/70">{x.d}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-surface">
            <div className="relative aspect-[16/10]">
              <Image
                src="/cialde/esempio-1.jpg"
                alt="Esempio cialda personalizzata"
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>
        </div>
      </div>

      <section className="mt-10 grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="rounded-3xl border border-border bg-background p-6 sm:p-8">
            <div>
              <div className="text-sm font-extrabold">1) Scegli il formato</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Option
                  selected={shape === "tonda"}
                  title="Tonda"
                  sub="Diam. 19,8 cm"
                  onClick={() => setShape("tonda")}
                />
                <Option
                  selected={shape === "rettangolare"}
                  title="Rettangolare"
                  sub="Max 27,6 × 18,41 cm"
                  onClick={() => setShape("rettangolare")}
                />
                <Option
                  selected={shape === "personalizzato"}
                  title="Personalizzato"
                  sub="Inserisci misure nelle note"
                  onClick={() => setShape("personalizzato")}
                />
              </div>
            </div>

            {needsNotes ? (
              <div className="mt-6">
                <div className="text-sm font-extrabold">Note (misure / richieste)</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-3 min-h-[90px] w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Es. 24×16 cm, bordo 1 cm, ritagliare seguendo profilo…"
                  disabled={busy}
                  maxLength={300}
                />
                <div className="mt-2 text-xs text-text/60">
                  Per il formato personalizzato indicaci misure e richieste (max 300 caratteri).
                </div>
              </div>
            ) : null}

            <div className="mt-8">
              <div className="text-sm font-extrabold">2) Scegli il materiale</div>
              <p className="mt-2 text-sm text-text/70">
                <strong>Pasta di zucchero</strong>: effetto più coprente e spesso colori più intensi. <br />
                <strong>Ostia</strong>: più sottile e leggera, scelta pratica e conveniente.
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Option
                  selected={material === "ostia"}
                  title="Ostia"
                  sub={eur(PRICE.ostia)}
                  onClick={() => setMaterial("ostia")}
                />
                <Option
                  selected={material === "pasta_di_zucchero"}
                  title="Pasta di zucchero"
                  sub={eur(PRICE.pasta_di_zucchero)}
                  onClick={() => setMaterial("pasta_di_zucchero")}
                />
              </div>
            </div>

            <div className="mt-8">
              <div className="text-sm font-extrabold">3) Cosa vuoi scrivere?</div>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="mt-3 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Es. Tanti auguri Max"
                disabled={busy}
                maxLength={120}
              />
              <div className="mt-2 text-xs text-text/60">
                Consiglio: massimo 120 caratteri per una stampa più leggibile.
              </div>
            </div>

            <div className="mt-8">
              <div className="text-sm font-extrabold">4) Carica l’immagine</div>

              <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:bg-surface-2">
                <div className="min-w-0">
                  <div className="text-sm font-extrabold">{file ? "File selezionato" : "Seleziona un file"}</div>
                  <div className="mt-1 truncate text-xs text-text/70">
                    {file ? file.name : `JPG/PNG/WebP consigliati • max ${MAX_FILE_MB}MB`}
                  </div>
                </div>

                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    // reset value per permettere di riselezionare lo stesso file
                    e.currentTarget.value = "";

                    setError(null);

                    const vf = validateFile(f);
                    if (!vf.ok) {
                      setFile(null);
                      setError(vf.error);
                      return;
                    }

                    setFile(f);
                  }}
                />

                <span className="shrink-0 rounded-xl border border-border bg-background px-3 py-2 text-xs font-extrabold">
                  Sfoglia
                </span>
              </label>

              {previewUrl ? (
                <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-background">
                  <div className="relative aspect-[16/10]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="Anteprima immagine caricata" className="h-full w-full object-cover" />
                  </div>
                </div>
              ) : null}

              <p className="mt-2 text-xs text-text/60">
                Carica solo immagini di cui possiedi i diritti o per cui hai autorizzazione all’uso.
              </p>
            </div>
          </div>
        </div>

        <aside className="lg:col-span-5">
          <div className="sticky top-6 rounded-3xl border border-border bg-background p-6 sm:p-8">
            <div className="text-sm font-extrabold">Riepilogo</div>

            <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-extrabold">Cialda personalizzata</div>
                  <div className="mt-1 text-xs text-text/70">{shapeLabel}</div>
                  <div className="mt-1 text-xs text-text/70">Materiale: {materialLabel}</div>
                  {needsNotes ? (
                    <div className="mt-2 text-xs text-text/70">
                      <span className="font-extrabold">Note:</span> {n || "—"}
                    </div>
                  ) : null}
                </div>
                <div className="text-sm font-extrabold">{eur(price)}</div>
              </div>

              <div className="mt-4">
                <div className="text-xs font-extrabold text-text/70">Dedica</div>
                <div className="mt-1 text-sm font-extrabold">“{t || "—"}”</div>
              </div>

              <div className="mt-4">
                <div className="text-xs font-extrabold text-text/70">Immagine</div>
                <div className="mt-1 text-sm font-extrabold">{file ? "Selezionata ✅" : "Da caricare"}</div>
              </div>
            </div>

            {error ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!canContinue}
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Caricamento..." : "Aggiungi al carrello"}
            </button>

            <div className="mt-3 text-xs text-text/60">
              Hai dubbi su materiale o qualità immagine? Scrivici su WhatsApp e ti aiutiamo.
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-10">
        <div className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
          <h2 className="text-xl font-extrabold">Domande frequenti</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background p-5">
              <div className="text-sm font-extrabold">Ostia o pasta di zucchero?</div>
              <p className="mt-2 text-sm text-text/70">
                L’ostia è più sottile e leggera. La pasta di zucchero è più “coprente” e spesso rende i colori più intensi.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-background p-5">
              <div className="text-sm font-extrabold">Che immagine devo caricare?</div>
              <p className="mt-2 text-sm text-text/70">
                Meglio una foto nitida (non screenshot piccoli). Più alta è la qualità del file, migliore sarà la stampa finale.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Option(props: { selected: boolean; title: string; sub: string; onClick: () => void }) {
  const { selected, title, sub, onClick } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border p-4 text-left transition",
        selected ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-surface-2",
      ].join(" ")}
    >
      <div className="text-sm font-extrabold">{title}</div>
      <div className="mt-1 text-xs text-text/70">{sub}</div>
    </button>
  );
}
