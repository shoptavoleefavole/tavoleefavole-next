// src/components/product/ProductTabs.tsx
"use client";

import { useMemo, useState } from "react";
import StrapiBlocks from "@/components/StrapiBlocks";
import FoodComplianceSection, {
  hasFoodComplianceData,
  type FoodInfoData,
  type NutritionData,
} from "@/components/product/FoodComplianceSection";

type Spec = { label: string; value: string };

export default function ProductTabs({
  description,
  descriptionBlocks,
  specs,
  details,
  foodInfo,
  nutrition,
  weightGrams,
}: {
  description?: string | null;
  descriptionBlocks?: unknown;
  specs?: Spec[] | null;
  details?: string | null;
  foodInfo?: FoodInfoData | null;
  nutrition?: NutritionData | null;
  weightGrams?: number | null;
}) {
  const showFoodTab = hasFoodComplianceData(foodInfo, nutrition);

  const tabs = useMemo(
    () => [
      { key: "descrizione", label: "Descrizione" },
      ...(showFoodTab
        ? [{ key: "etichetta", label: "Ingredienti, Allergeni e Nutrizione" }]
        : []),
      { key: "dettagli", label: "Dettagli prodotto" },
    ],
    [showFoodTab]
  );

  const [active, setActive] = useState<string>("descrizione");

  return (
    <section id="scheda-tecnica" className="mt-10 scroll-mt-28">
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                on
                  ? "bg-primary text-primary-contrast"
                  : "border border-border hover:bg-surface-2"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-background p-5">
        {active === "descrizione" && (
          <div className="prose prose-sm max-w-none">
            {descriptionBlocks ? (
              <StrapiBlocks blocks={descriptionBlocks} />
            ) : (
              <p className="text-sm leading-relaxed text-text/80">
                {description || "Descrizione non disponibile."}
              </p>
            )}
          </div>
        )}

        {active === "etichetta" && showFoodTab && (
          <FoodComplianceSection
            foodInfo={foodInfo}
            nutrition={nutrition}
            fallbackWeightGrams={weightGrams}
          />
        )}

        {active === "dettagli" && (
          <>
            {specs && specs.length ? (
              <ul className="divide-y divide-border">
                {specs.map((s) => (
                  <li key={s.label} className="flex items-start justify-between gap-6 py-3">
                    <span className="text-sm font-semibold">{s.label}</span>
                    <span className="text-sm text-text/80">{s.value}</span>
                  </li>
                ))}
              </ul>
            ) : details ? (
              <div className="prose prose-sm max-w-none whitespace-pre-line">
                <p className="text-sm leading-relaxed text-text/80">{details}</p>
              </div>
            ) : (
              <p className="text-sm text-text/70">Dettagli prodotto non disponibili.</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}