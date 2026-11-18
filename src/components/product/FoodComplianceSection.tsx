// src/components/product/FoodComplianceSection.tsx
import StrapiBlocks from "@/components/StrapiBlocks";

export type FoodInfoData = {
  denominazioneLegale?: string | null;
  ingredienti?: unknown;
  allergeni?: string | null;
  quantitaNetta?: string | null;
  titoloAlcolometrico?: string | null;
  conservazioneUso?: string | null;
  operatoreAlimentare?: string | null;
  origine?: string | null;
  etichettaturaAmbientale?: string | null;
};

export type NutritionData = {
  riferimento?: "100 g" | "100 ml" | string | null;
  energiaKj?: number | null;
  energiaKcal?: number | null;
  grassi?: number | null;
  acidiGrassiSaturi?: number | null;
  carboidrati?: number | null;
  zuccheri?: number | null;
  proteine?: number | null;
  sale?: number | null;
  fibre?: number | null;
};

function fmtNum(v: number | null | undefined, unit = "g"): string | null {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return null;
  return `${String(Number(v)).replace(".", ",")} ${unit}`;
}

export function hasFoodComplianceData(
  foodInfo?: FoodInfoData | null,
  nutrition?: NutritionData | null
): boolean {
  const hasFood = Boolean(
    foodInfo &&
      Object.entries(foodInfo).some(
        ([k, v]) => k !== "id" && v !== null && v !== undefined && String(v).trim() !== ""
      )
  );
  const hasNutr = Boolean(
    nutrition &&
      [
        nutrition.energiaKj,
        nutrition.energiaKcal,
        nutrition.grassi,
        nutrition.carboidrati,
        nutrition.proteine,
        nutrition.sale,
      ].some((v) => v !== null && v !== undefined)
  );
  return hasFood || hasNutr;
}

export default function FoodComplianceSection({
  foodInfo,
  nutrition,
  fallbackWeightGrams,
}: {
  foodInfo?: FoodInfoData | null;
  nutrition?: NutritionData | null;
  fallbackWeightGrams?: number | null;
}) {
  if (!hasFoodComplianceData(foodInfo, nutrition)) return null;

  const netQty =
    foodInfo?.quantitaNetta?.trim() ||
    (fallbackWeightGrams && fallbackWeightGrams > 0 ? `${fallbackWeightGrams} g` : null);

  const refUnit = nutrition?.riferimento || "100 g";
  const hasEnergy = nutrition?.energiaKj != null || nutrition?.energiaKcal != null;

  const nutritionRows: Array<{ label: string; value: string | null; indent?: boolean }> = [
    {
      label: "Energia",
      value: hasEnergy
        ? [
            nutrition?.energiaKj != null ? `${nutrition.energiaKj} kJ` : null,
            nutrition?.energiaKcal != null ? `${nutrition.energiaKcal} kcal` : null,
          ]
            .filter(Boolean)
            .join(" / ")
        : null,
    },
    { label: "Grassi", value: fmtNum(nutrition?.grassi) },
    { label: "di cui acidi grassi saturi", value: fmtNum(nutrition?.acidiGrassiSaturi), indent: true },
    { label: "Carboidrati", value: fmtNum(nutrition?.carboidrati) },
    { label: "di cui zuccheri", value: fmtNum(nutrition?.zuccheri), indent: true },
    { label: "Fibre", value: fmtNum(nutrition?.fibre) },
    { label: "Proteine", value: fmtNum(nutrition?.proteine) },
    { label: "Sale", value: fmtNum(nutrition?.sale) },
  ].filter((r) => Boolean(r.value));

  return (
    <div className="space-y-6 text-sm text-text/85">
      {/* Riquadro Allergeni in evidenza (Reg. UE 1169/2011 Art. 21) */}
      {foodInfo?.allergeni ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 text-amber-950"
        >
          <div className="text-xs font-extrabold uppercase tracking-wide text-amber-900">
            Allergeni e contaminazioni crociate
          </div>
          <p className="mt-1 whitespace-pre-line font-medium leading-relaxed">
            {foodInfo.allergeni}
          </p>
        </div>
      ) : null}

      {/* Elenco Ingredienti (con grassetti preservati per gli allergeni) */}
      {foodInfo?.ingredienti ? (
        <div>
          <h3 className="text-sm font-extrabold text-text">Ingredienti</h3>
          <div className="mt-1.5">
            <StrapiBlocks blocks={foodInfo.ingredienti} />
          </div>
          <p className="mt-1.5 text-xs text-text/60">
            Gli ingredienti evidenziati in <strong>grassetto</strong> possono provocare allergie o
            intolleranze (Reg. UE 1169/2011, Allegato II).
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Informazioni obbligatorie di etichetta */}
        <div className={nutritionRows.length ? "lg:col-span-7" : "lg:col-span-12"}>
          <dl className="divide-y divide-border rounded-xl border border-border">
            {foodInfo?.denominazioneLegale ? (
              <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
                <dt className="font-semibold text-text">Denominazione legale</dt>
                <dd className="sm:col-span-2">{foodInfo.denominazioneLegale}</dd>
              </div>
            ) : null}

            {netQty ? (
              <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
                <dt className="font-semibold text-text">Quantità netta</dt>
                <dd className="sm:col-span-2">{netQty}</dd>
              </div>
            ) : null}

            {foodInfo?.titoloAlcolometrico ? (
              <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
                <dt className="font-semibold text-text">Titolo alcolometrico</dt>
                <dd className="sm:col-span-2">{foodInfo.titoloAlcolometrico}</dd>
              </div>
            ) : null}

            {foodInfo?.conservazioneUso ? (
              <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
                <dt className="font-semibold text-text">Conservazione e uso</dt>
                <dd className="whitespace-pre-line sm:col-span-2">{foodInfo.conservazioneUso}</dd>
              </div>
            ) : null}

            {foodInfo?.origine ? (
              <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
                <dt className="font-semibold text-text">Paese di origine / provenienza</dt>
                <dd className="sm:col-span-2">{foodInfo.origine}</dd>
              </div>
            ) : null}

            {foodInfo?.operatoreAlimentare ? (
              <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
                <dt className="font-semibold text-text">Operatore del Settore Alimentare</dt>
                <dd className="whitespace-pre-line sm:col-span-2">{foodInfo.operatoreAlimentare}</dd>
              </div>
            ) : null}

            {foodInfo?.etichettaturaAmbientale ? (
              <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
                <dt className="font-semibold text-text">Smaltimento imballaggi</dt>
                <dd className="whitespace-pre-line sm:col-span-2">
                  {foodInfo.etichettaturaAmbientale}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>

        {/* Tabella Dichiarazione Nutrizionale */}
        {nutritionRows.length > 0 ? (
          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="bg-surface-2/70 px-4 py-2.5 text-xs font-extrabold uppercase tracking-wide text-text">
                Valori nutrizionali medi per {refUnit}
              </div>
              <table className="w-full divide-y divide-border text-sm">
                <tbody className="divide-y divide-border">
                  {nutritionRows.map((row) => (
                    <tr key={row.label}>
                      <td className={`px-4 py-2.5 ${row.indent ? "pl-8 text-text/75" : "font-medium text-text"}`}>
                        {row.label}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-text">
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      <p className="text-xs text-text/60">
        Le indicazioni su ingredienti e valori nutrizionali possono subire variazioni da parte dei
        produttori. Prima del consumo verificare sempre le informazioni riportate sull&apos;etichetta
        fisica del prodotto consegnato.
      </p>
    </div>
  );
}