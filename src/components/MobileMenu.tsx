"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { categories } from "@/lib/data";

export default function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="w-full max-w-md rounded-2xl border border-border bg-background p-0 backdrop:bg-black/40"
      onClose={onClose}
    >
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="text-sm font-semibold text-text">Menu</div>
        <button
          onClick={onClose}
          className="rounded-xl px-3 py-2 text-sm text-text hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Chiudi menu"
        >
          Chiudi
        </button>
      </div>

      <nav aria-label="Navigazione mobile" className="p-4">
        <div className="space-y-1">
          <Link href="/catalogo" onClick={onClose} className="block rounded-xl px-3 py-2 text-sm hover:bg-surface-2">
            Tutti i prodotti
          </Link>
          <Link
            href="/ricorrenze"
            onClick={onClose}
            className="block rounded-xl px-3 py-2 text-sm text-link hover:text-link-hover hover:bg-surface-2"
          >
            Ricorrenze
          </Link>
        </div>

        <div className="mt-4 text-xs font-semibold text-muted-text">Categorie</div>
        <div className="mt-2 space-y-1">
          {categories.map((c) => (
            <Link key={c.slug} href={`/categoria/${c.slug}`} onClick={onClose} className="block rounded-xl px-3 py-2 text-sm hover:bg-surface-2">
              {c.name}
            </Link>
          ))}
        </div>

        <div className="mt-4 text-xs font-semibold text-muted-text">Altro</div>
        <div className="mt-2 space-y-1">
          <Link href="/account" onClick={onClose} className="block rounded-xl px-3 py-2 text-sm hover:bg-surface-2">
            Account
          </Link>
          <Link href="/supporto" onClick={onClose} className="block rounded-xl px-3 py-2 text-sm hover:bg-surface-2">
            Supporto
          </Link>
        </div>
      </nav>
    </dialog>
  );
}
