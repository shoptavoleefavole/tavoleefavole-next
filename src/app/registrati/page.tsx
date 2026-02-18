"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

function Card({
  title,
  desc,
  badge,
  onClick,
}: {
  title: string;
  desc: string;
  badge: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left rounded-3xl border border-border bg-background p-6 shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xl font-extrabold">{title}</div>
          <div className="mt-2 text-sm text-text/70 leading-relaxed">{desc}</div>
        </div>
        <div className="shrink-0 rounded-full bg-surface px-3 py-1 text-xs font-extrabold text-text/70">
          {badge}
        </div>
      </div>

      <div className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-primary group-hover:underline">
        Continua
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M10 7l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </button>
  );
}

export default function RegisterChooserPage() {
  const router = useRouter();
  const sp = useSearchParams();

  // preserva eventuale next (es. /account)
  const next = useMemo(() => {
    const n = sp.get("next");
    return n ? `?next=${encodeURIComponent(n)}` : "";
  }, [sp]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="rounded-3xl border border-border bg-background p-8 shadow-sm">
        <h1 className="text-3xl font-extrabold">Crea il tuo account</h1>
        <p className="mt-2 text-sm text-text/70">
          Seleziona il tipo di profilo per completare la registrazione.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card
            title="Privato"
            badge="B2C"
            desc="Per acquisti personali. Potrai inserire (facoltativo) il codice fiscale per la fattura."
            onClick={() => router.push(`/registrati/privato${next}`)}
          />
          <Card
            title="Azienda"
            badge="B2B"
            desc="Per attività e professionisti. Ti chiederemo Ragione sociale, P.IVA, PEC e SDI (tutti obbligatori)."
            onClick={() => router.push(`/registrati/azienda${next}`)}
          />
        </div>

        <div className="mt-8 flex items-center justify-between text-sm">
          <span className="text-text/70">Hai già un account?</span>
          <Link href="/accedi" className="font-extrabold underline">
            Accedi
          </Link>
        </div>
      </div>
    </main>
  );
}
