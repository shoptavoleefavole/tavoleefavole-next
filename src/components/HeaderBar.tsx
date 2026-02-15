"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" strokeWidth="2" />
      <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CartIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 7h15l-1.5 8.5H7.2L6 7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M6 7 5 4H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function UserIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Z" stroke="currentColor" strokeWidth="2" />
      <path d="M4 20c1.8-4 14.2-4 16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function clampQuery(raw: string) {
  // ✅ robustezza: limita query per evitare input “abusivi” / URL enormi
  const s = String(raw ?? "").trim();
  if (!s) return "";
  return s.length > 120 ? s.slice(0, 120) : s;
}

export default function HeaderBar() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();

  const placeholder = useMemo(() => "Cerca prodotti, categorie, confetti…", []);

  // ✅ inizializza la query da URL (es: /catalogo?q=vaniglia)
  const [q, setQ] = useState(() => clampQuery(searchParams.get("q") ?? ""));

  // ✅ sync: se cambia URL (back/forward o navigazioni), aggiorna input
  useEffect(() => {
    const urlQ = clampQuery(searchParams.get("q") ?? "");
    // evita setState inutile
    setQ((prev) => (prev === urlQ ? prev : urlQ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  function goSearch(value: string) {
    const query = clampQuery(value);

    // se vuoto → catalogo “pulito”
    const target = query ? `/catalogo?q=${encodeURIComponent(query)}` : "/catalogo";

    // ✅ evita push inutile
    const currentQs = searchParams.toString();
    const current = `${pathname}${currentQs ? `?${currentQs}` : ""}`;
    if (current === target) return;

    router.push(target);
  }

  return (
    <header className="sticky top-0 z-[95000] border-b border-border bg-background/95 backdrop-blur">
      {/* Top strip */}
      <div className="hidden sm:block">
        <div className="mx-auto max-w-7xl px-4 py-2 text-xs text-text/70">
          Spedizioni rapide · Pagamenti sicuri · Supporto clienti
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Logo / Brand */}
          <Link href="/" className="shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <div className="text-base font-extrabold leading-none sm:text-lg">
              Tavole<span className="text-text/50"> & </span>Favole
            </div>
            <div className="hidden text-xs text-text/60 sm:block">Shop online</div>
          </Link>

          {/* Search */}
          <form
            className="mx-1 flex min-w-0 flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              goSearch(q);
            }}
            role="search"
            aria-label="Ricerca prodotti"
          >
            <div className="relative w-full">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text/50" />

              <input
                type="search"
                value={q}
                onChange={(e) => setQ(clampQuery(e.target.value))}
                placeholder={placeholder}
                autoComplete="off"
                inputMode="search"
                className={[
                  "h-11 w-full rounded-2xl border border-border bg-surface px-10 text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-primary",
                ].join(" ")}
                aria-label="Cerca nel catalogo"
              />

              {q ? (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-3 py-2 text-xs font-extrabold hover:bg-black/5"
                  onClick={() => {
                    setQ("");
                    router.push("/catalogo");
                  }}
                  aria-label="Reset ricerca"
                >
                  Reset
                </button>
              ) : null}
            </div>

            <button
              type="submit"
              className="hidden h-11 shrink-0 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover sm:inline-flex"
              aria-label="Cerca"
            >
              Cerca
            </button>
          </form>

          {/* Icons */}
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/account"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Account"
              title="Account"
            >
              <UserIcon className="h-6 w-6" />
            </Link>

            <Link
              href="/carrello"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Carrello"
              title="Carrello"
            >
              <CartIcon className="h-6 w-6" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
