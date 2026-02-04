"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { categories } from "@/lib/data";

export default function MobileMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // Chiude cliccando sul backdrop (fuori dal pannello)
  function onBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    const dialog = ref.current;
    if (!dialog) return;
    // Se il click è sul dialog stesso (backdrop) e non sul contenuto interno
    if (e.target === dialog) onClose();
  }

  return (
    <dialog
      ref={ref}
      className="w-full max-w-md rounded-2xl border border-border bg-background p-0 backdrop:bg-black/40"
      onClose={onClose}
      onClick={onBackdropClick}
    >
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="text-sm font-semibold text-text">Menu</div>
        <button
          onClick={onClose}
          type="button"
          className="rounded-xl px-3 py-2 text-sm text-text hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Chiudi menu"
        >
          Chiudi
        </button>
      </div>

      <nav aria-label="Navigazione mobile" className="p-4">
        {/* Link principali */}
        <div className="space-y-1">
          <Link
            href="/catalogo"
            onClick={onClose}
            className="block rounded-xl px-3 py-2 text-sm hover:bg-surface-2"
          >
            Tutti i prodotti
          </Link>

          <Link
            href="/ricorrenze"
            onClick={onClose}
            className="block rounded-xl px-3 py-2 text-sm text-link hover:text-link-hover hover:bg-surface-2"
          >
            Ricorrenze
          </Link>

          <Link
            href="/chi-siamo"
            onClick={onClose}
            className="block rounded-xl px-3 py-2 text-sm hover:bg-surface-2"
          >
            Chi siamo
          </Link>

          <Link
            href="/contatti"
            onClick={onClose}
            className="block rounded-xl px-3 py-2 text-sm hover:bg-surface-2"
          >
            Contatti
          </Link>
        </div>

        {/* Categorie */}
        <div className="mt-4 text-xs font-semibold text-muted-text">
          Categorie
        </div>
        <div className="mt-2 space-y-1">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/categoria/${c.slug}`}
              onClick={onClose}
              className="block rounded-xl px-3 py-2 text-sm hover:bg-surface-2"
            >
              {c.name}
            </Link>
          ))}
        </div>

        {/* Assistenza */}
        <div className="mt-4 text-xs font-semibold text-muted-text">
          Assistenza
        </div>
        <div className="mt-2 space-y-1">
          <Link
            href="/supporto"
            onClick={onClose}
            className="block rounded-xl px-3 py-2 text-sm hover:bg-surface-2"
          >
            Supporto
          </Link>
          <Link
            href="/spedizioni"
            onClick={onClose}
            className="block rounded-xl px-3 py-2 text-sm hover:bg-surface-2"
          >
            Spedizioni
          </Link>
          <Link
            href="/resi-rimborsi"
            onClick={onClose}
            className="block rounded-xl px-3 py-2 text-sm hover:bg-surface-2"
          >
            Resi &amp; rimborsi
          </Link>
        </div>

        {/* Legale */}
        <div className="mt-4 text-xs font-semibold text-muted-text">
          Info legali
        </div>
        <div className="mt-2 space-y-1">
          <Link
            href="/privacy"
            onClick={onClose}
            className="block rounded-xl px-3 py-2 text-sm hover:bg-surface-2"
          >
            Privacy
          </Link>
          <Link
            href="/cookie"
            onClick={onClose}
            className="block rounded-xl px-3 py-2 text-sm hover:bg-surface-2"
          >
            Cookie
          </Link>
          <Link
            href="/termini"
            onClick={onClose}
            className="block rounded-xl px-3 py-2 text-sm hover:bg-surface-2"
          >
            Termini e condizioni
          </Link>
        </div>

        {/* Account */}
        <div className="mt-4 text-xs font-semibold text-muted-text">Account</div>
        <div className="mt-2 space-y-1">
          <Link
            href="/account"
            onClick={onClose}
            className="block rounded-xl px-3 py-2 text-sm hover:bg-surface-2"
          >
            Area personale
          </Link>
        </div>
      </nav>
    </dialog>
  );
}
