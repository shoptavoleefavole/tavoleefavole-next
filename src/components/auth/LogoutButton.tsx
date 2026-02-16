"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton({
  redirectTo = "/",
  className = "",
  children = "Logout",
}: {
  redirectTo?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onLogout() {
    if (loading) return;
    setErr(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      // Anche se res non è ok, forziamo comunque refresh/redirect (difesa UX)
      if (!res.ok) setErr("Logout non riuscito. Riprova.");

      // 🔥 Questo è il punto chiave: forziamo un nuovo rendering server-side
      router.replace(redirectTo);
      router.refresh();

      // Se hai componenti “duri a morire” per cache, fallback hard:
      // window.location.href = redirectTo;
    } catch {
      setErr("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onLogout}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-xl border border-border bg-white px-4 py-2 text-sm font-extrabold hover:bg-surface disabled:opacity-60"
      >
        {loading ? "Uscita…" : children}
      </button>
      {err ? <div className="mt-2 text-xs text-red-600">{err}</div> : null}
    </div>
  );
}
