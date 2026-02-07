"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // evita spam log in dev (React StrictMode)
  const loggedRef = useRef(false);

  useEffect(() => {
    if (loggedRef.current) return;
    loggedRef.current = true;

    // Log minimale lato client (in futuro: invio a Sentry/Logflare)
    // eslint-disable-next-line no-console
    console.error("Global error boundary:", error);
  }, [error]);

  const onRetry = () => {
    try {
      reset();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Error while reset():", e);
      // fallback: reload pagina
      window.location.reload();
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <h1 className="text-3xl font-extrabold">Ops, qualcosa è andato storto</h1>
      <p className="mt-3 text-sm text-text/70">
        Riprova oppure torna al catalogo. Se il problema persiste, contattaci.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onRetry}
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

        <Link
          href="/"
          className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-bold hover:bg-surface-2"
        >
          Home
        </Link>

        <Link
          href="/contatti"
          className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-bold hover:bg-surface-2"
        >
          Contattaci
        </Link>
      </div>

      {/* Debug solo in dev */}
      {process.env.NODE_ENV === "development" ? (
        <div className="mt-8 rounded-2xl border border-border bg-background p-4 text-xs text-text/70">
          <div className="font-semibold">Debug</div>
          <div className="mt-2">
            <b>message:</b> {String(error?.message || "Unknown error")}
          </div>
          {error?.digest ? <div className="mt-2">digest: {error.digest}</div> : null}
          {error?.stack ? (
            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-surface p-3 text-[11px] text-text/80">
              {error.stack}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
