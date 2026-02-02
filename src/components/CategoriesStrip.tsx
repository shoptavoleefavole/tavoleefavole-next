"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

import type { MacroCategory } from "@/data/categories";
import { macroCategories } from "@/data/categories";

export default function CategoriesStrip() {
  const categories: MacroCategory[] = Array.isArray(macroCategories) ? macroCategories : [];
  const searchParams = useSearchParams();
  const active = searchParams.get("categoria") ?? "";

  return (
    <div className="py-2">
      <nav
        aria-label="Macroaree"
        // Nota: su schermi piccoli preferiamo scroll orizzontale (senza wrap).
        className="mx-auto flex w-full max-w-7xl items-center gap-3 overflow-x-auto px-3 lg:justify-center [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/?categoria=${encodeURIComponent(c.slug)}`}
            aria-current={active === c.slug ? "page" : undefined}
            // IMPORTANT: flex-none + min-w-max + whitespace-nowrap + break-keep
            // => niente a-capo, e se non entra, scroll orizzontale.
            className={`flex-none min-w-max inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              active === c.slug ? "bg-surface-2" : ""
            }`}
          >
            <Image
              src={c.icon}
              alt={`${c.label} - icona`}
              width={18}
              height={18}
              sizes="18px"
              loading="lazy"
              unoptimized
              className="shrink-0"
            />
            <span className="whitespace-nowrap break-keep leading-none">{c.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
