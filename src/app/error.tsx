"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log minimale lato client (in futuro: invio a Sentry/Logflare)
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <h1 className="text-3xl font-extrabold">Ops, qualcosa è andato storto</h1>
      <p className="mt-3 text-sm text-text/70">
        Riprova oppure torna al catalogo. Se il problema persiste, contattaci.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-xl bg-primary px-4 py-3 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover"
        >
          Riprova
        </button>
        <Link
          href="/catalogo"
          className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-bold hover:bg-surface-2"
        >
          Vai al Catalogo
        </Link>
      </div>

      {/* Mostriamo il digest solo in dev per debug rapido */}
      {process.env.NODE_ENV === "development" && error.digest ? (
        <div className="mt-8 rounded-2xl border border-border bg-background p-4 text-xs text-text/70">
          <div className="font-semibold">Debug</div>
          <div className="mt-2">digest: {error.digest}</div>
        </div>
      ) : null}
    </div>
  );
}
