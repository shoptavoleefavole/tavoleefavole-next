"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      // Anche se fallisse, facciamo comunque refresh UI per non rimanere "stuck"
      if (!res.ok) {
        // niente dettagli per sicurezza
      }

      // ✅ forza aggiornamento UI e cookie state
      router.replace("/");
      router.refresh();
    } catch {
      // Errore rete: comunque prova a ripulire UI
      router.replace("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm font-extrabold hover:bg-surface disabled:opacity-60"
    >
      {loading ? "Uscita..." : "Esci"}
    </button>
  );
}
