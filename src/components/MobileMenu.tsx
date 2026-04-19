"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

// fallback legacy (se qualche callsite non passa categories)
import { categories as staticCategories } from "@/lib/data";

type NavSub = { slug: string; label: string };
type NavCat = { slug: string; label: string; icon?: string | null; subcategories?: NavSub[] };

function CloseIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChevronRight({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function safeString(v: unknown, fallback = "") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function normalizeCategories(input?: any[]): NavCat[] {
  const list = Array.isArray(input) ? input : [];
  const out: NavCat[] = [];

  for (const row of list) {
    const slug = safeString(row?.slug, "");
    if (!slug) continue;

    const label = safeString(row?.label ?? row?.name ?? row?.title, slug);

    const subsRaw = row?.subcategories ?? row?.subs ?? [];
    const subcategories: NavSub[] = Array.isArray(subsRaw)
      ? subsRaw
          .map((s: any) => {
            const sSlug = safeString(s?.slug, "");
            if (!sSlug) return null;
            const sLabel = safeString(s?.label ?? s?.name ?? s?.title, sSlug);
            return { slug: sSlug, label: sLabel };
          })
          .filter(Boolean) as NavSub[]
      : [];

    out.push({ slug, label, icon: row?.icon ?? null, subcategories });
  }

  return out;
}

export default function MobileMenu({
  open,
  onClose,
  categories,
  catsLoaded,
  cartCount,
}: {
  open: boolean;
  onClose: () => void;
  categories?: NavCat[];
  catsLoaded?: boolean;
  cartCount?: number;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const [openMacroSlug, setOpenMacroSlug] = useState<string | null>(null);

  const normalizedFromProps = useMemo(() => normalizeCategories(categories as any[]), [categories]);

  const fallbackFromStatic = useMemo(() => {
    // staticCategories spesso è [{slug,name}], lo trasformiamo
    const mapped = Array.isArray(staticCategories)
      ? staticCategories.map((c: any) => ({ slug: c.slug, label: c.name ?? c.label ?? c.slug, subcategories: [] }))
      : [];
    return normalizeCategories(mapped);
  }, []);

  const displayedCategories = normalizedFromProps.length ? normalizedFromProps : fallbackFromStatic;
  const loaded = Boolean(catsLoaded) || normalizedFromProps.length > 0 || fallbackFromStatic.length > 0;

  // dialog open/close
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();

    if (!open) setOpenMacroSlug(null);
  }, [open]);

  // scroll lock (iOS / mobile)
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  function onBackdropClick(e: MouseEvent<HTMLDialogElement>) {
    const dialog = ref.current;
    if (!dialog) return;
    if (e.target === dialog) onClose();
  }

  return (
    <dialog
      ref={ref}
      className="w-full max-w-md rounded-2xl border border-border bg-background p-0 backdrop:bg-black/40"
      onClose={onClose}
      onClick={onBackdropClick}
      aria-label="Menu"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="text-sm font-extrabold text-text">Menu</div>
        <button
          onClick={onClose}
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Chiudi menu"
        >
          <CloseIcon />
        </button>
      </div>

      <nav aria-label="Navigazione mobile" className="p-4">
        {/* scorciatoie */}
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/account"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-2xl border border-border bg-background px-3 py-3 text-sm font-extrabold hover:bg-surface-2"
          >
            Account
          </Link>

          <Link
            href="/carrello"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-2xl border border-border bg-background px-3 py-3 text-sm font-extrabold hover:bg-surface-2"
          >
            Carrello{typeof cartCount === "number" ? ` (${cartCount})` : ""}
          </Link>
        </div>

        <div className="my-4 border-t border-border" />

        {/* Link principali */}
        <div className="space-y-2">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 text-sm font-extrabold hover:bg-surface-2"
          >
            <span>Home</span>
            <ChevronRight className="opacity-60" />
          </Link>

          <Link
            href="/catalogo"
            onClick={onClose}
            className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 text-sm font-extrabold hover:bg-surface-2"
          >
            <span>Catalogo</span>
            <ChevronRight className="opacity-60" />
          </Link>
        </div>

        <div className="my-4 border-t border-border" />

        {/* Categorie */}
        <div>
          <div className="px-1 text-xs font-extrabold uppercase tracking-wide text-muted-text">Categorie</div>

          {!loaded ? (
            <div className="mt-3 rounded-2xl border border-border bg-background p-4 text-sm text-muted-text">
              Caricamento categorie…
            </div>
          ) : displayedCategories.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-border bg-background p-4 text-sm text-muted-text">
              Nessuna categoria configurata.
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {displayedCategories.map((c) => {
                const isOpen = openMacroSlug === c.slug;
                const subs = Array.isArray(c.subcategories) ? c.subcategories : [];
                const hasSubs = subs.length > 0;

                return (
                  <li key={c.slug} className="rounded-2xl border border-border bg-background">
                    <button
                      type="button"
                      onClick={() => setOpenMacroSlug(isOpen ? null : c.slug)}
                      className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left hover:bg-surface-2"
                      aria-expanded={isOpen}
                      aria-controls={`macro-${c.slug}`}
                    >
                      <span className="min-w-0 truncate text-sm font-extrabold">{c.label}</span>
                      <ChevronRight
                        className={`shrink-0 transition-transform ${hasSubs && isOpen ? "rotate-90" : ""} ${
                          hasSubs ? "" : "opacity-60"
                        }`}
                      />
                    </button>

                    {isOpen ? (
                      <div id={`macro-${c.slug}`} className="px-4 pb-3">
                        <div className="grid gap-1">
                          <Link
                            href={`/categoria/${c.slug}`}
                            onClick={onClose}
                            className="rounded-xl px-3 py-2 text-sm font-semibold hover:bg-surface-2"
                          >
                            Tutti
                          </Link>

                          {subs.map((sub) => (
                            <Link
                              key={sub.slug}
                              href={`/categoria/${c.slug}/${sub.slug}`}
                              onClick={onClose}
                              className="rounded-xl px-3 py-2 text-sm font-semibold hover:bg-surface-2"
                            >
                              {sub.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-6 border-t border-border pt-4 text-xs font-semibold text-muted-text">Assistenza</div>
        <div className="mt-2 space-y-1">
          <Link href="/spedizioni" onClick={onClose} className="block rounded-xl px-3 py-2 text-sm hover:bg-surface-2">
            Spedizioni
          </Link>
          <Link href="/resi" onClick={onClose} className="block rounded-xl px-3 py-2 text-sm hover:bg-surface-2">
            Resi &amp; rimborsi
          </Link>
          <a
            href="https://www.iubenda.com/privacy-policy/47702140"
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="block rounded-xl px-3 py-2 text-sm hover:bg-surface-2"
          >
            Privacy
          </a>
          <a
            href="https://www.iubenda.com/privacy-policy/47702140/cookie-policy"
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="block rounded-xl px-3 py-2 text-sm hover:bg-surface-2"
          >
            Cookie Policy
          </a>
          <Link href="/termini" onClick={onClose} className="block rounded-xl px-3 py-2 text-sm hover:bg-surface-2">
            Termini e condizioni
          </Link>
        </div>
      </nav>
    </dialog>
  );
}
