"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function logout() {
    try {
      await fetch("/api/account/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
    } finally {
      // torna home e forza refresh stato server
      router.push("/");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-extrabold hover:bg-surface"
    >
      Esci
    </button>
  );
}
