// src/app/cookie-policy/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cookie Policy",
};

const COOKIE_URL = "https://www.iubenda.com/privacy-policy/47702140/cookie-policy";

export default function CookiePolicyPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Cookie Policy</h1>
      <p className="mt-2 text-sm text-text/70">
        La Cookie Policy è gestita e mantenuta aggiornata tramite Iubenda.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-background p-6">
        <div className="text-sm font-semibold">Documento ufficiale (Iubenda)</div>
        <p className="mt-2 text-sm text-text/70">
          Clicca sul link qui sotto per aprire la Cookie Policy.
        </p>

        {/* Embed Iubenda (usa lo script già caricato nel layout) */}
        <div className="mt-4">
          <a
            href={COOKIE_URL}
            className="iubenda-white no-brand iubenda-noiframe iubenda-embed"
            title="Cookie Policy"
          >
            Cookie Policy
          </a>
        </div>

        <noscript>
          <div className="mt-4 rounded-xl border border-border bg-surface p-4 text-sm text-text/70">
            JavaScript è disattivato: puoi aprire la Cookie Policy qui:
            <div className="mt-2">
              <a className="text-link hover:text-link-hover" href={COOKIE_URL}>
                {COOKIE_URL}
              </a>
            </div>
          </div>
        </noscript>
      </div>

      <div className="mt-6 text-sm text-text/70">
        Hai bisogno di aiuto? Vai alla pagina{" "}
        <Link className="text-link hover:text-link-hover font-semibold" href="/contatti">
          Contatti
        </Link>
        .
      </div>
    </main>
  );
}
