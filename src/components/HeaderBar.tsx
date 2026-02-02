"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M16.5 16.5 21 21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CartIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 7h15l-1.5 8.5H7.2L6 7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
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
      <path
        d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M4 20c1.8-4 14.2-4 16 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function getQFromPath(pathname: string) {
  // non usiamo searchParams qui (client), quindi manteniamo la query in state.
  // Se vuoi leggere q dall’URL, lo aggiungiamo in un secondo step.
  void pathname;
  return "";
}

export default function HeaderBar() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";

  const [q, setQ] = useState("");

  // piccolo “reset” quando cambi pagina
  useEffect(() => {
    // opzionale: se vuoi mantenere la query anche cambiando pagina, rimuovi questa riga
    if (pathname === "/") return;
  }, [pathname]);

  const placeholder = useMemo(() => {
    // stile Deghi: ricerca sempre presente
    return "Cerca prodotti, categorie, confetti…";
  }, []);

  function goSearch(value: string) {
    const query = value.trim();
    if (!query) {
      router.push("/catalogo");
      return;
    }
    router.push(`/catalogo?q=${encodeURIComponent(query)}`);
  }

  return (
    <header className="sticky top-0 z-[95000] border-b border-border bg-background/95 backdrop-blur">
      {/* Top strip (opzionale, molto Deghi-like) */}
      <div className="hidden sm:block">
        <div className="mx-auto max-w-7xl px-4 py-2 text-xs text-text/70">
          Spedizioni rapide · Pagamenti sicuri · Supporto clienti
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Logo / Brand */}
          <Link href="/" className="shrink-0">
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
          >
            <div className="relative w-full">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text/50" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={placeholder}
                className={[
                  "h-11 w-full rounded-2xl border border-border bg-surface px-10 text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-primary",
                ].join(" ")}
              />
              {q ? (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-3 py-2 text-xs font-extrabold hover:bg-black/5"
                  onClick={() => {
                    setQ("");
                    router.push("/catalogo");
                  }}
                >
                  Reset
                </button>
              ) : null}
            </div>

            <button
              type="submit"
              className="hidden h-11 shrink-0 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover sm:inline-flex"
            >
              Cerca
            </button>
          </form>

          {/* Icons */}
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/account"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border hover:bg-surface-2"
              aria-label="Account"
              title="Account"
            >
              <UserIcon className="h-6 w-6" />
            </Link>

            <Link
              href="/carrello"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border hover:bg-surface-2"
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
