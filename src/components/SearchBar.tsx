"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SearchBar() {
  const [q, setQ] = useState("");
  const router = useRouter();

  return (
    <form
      role="search"
      className="relative"
      onSubmit={(e) => {
        e.preventDefault();
        const query = q.trim();
        router.push(query ? `/catalogo?q=${encodeURIComponent(query)}` : "/catalogo");
      }}
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cerca prodotti…"
        aria-label="Cerca prodotti"
        className="h-10 w-full rounded-xl border border-border bg-background px-10 text-sm text-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-text" aria-hidden="true">
        ⌕
      </span>
    </form>
  );
}
