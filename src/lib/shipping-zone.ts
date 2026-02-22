// src/lib/shipping-zone.ts
export type ShippingZone = "IT_MAINLAND" | "IT_ISLANDS";

export type ShippingAddress = {
  country?: string | null;
  postalCode?: string | null;
  province?: string | null; // preferibilmente sigla (es. "CA", "PA")
};

const ISLAND_PROVINCES = new Set([
  // Sicilia
  "AG", "CL", "CT", "EN", "ME", "PA", "RG", "SR", "TP",
  // Sardegna (include sigle nuove/vecchie)
  "CA", "CI", "SU", "NU", "OR", "SS", "OG", "OT",
]);

function norm(v: any) {
  return String(v ?? "").trim();
}

export function computeShippingZoneFromAddress(addr: ShippingAddress): ShippingZone {
  const country = norm(addr.country || "IT").toUpperCase();
  const province = norm(addr.province).toUpperCase();
  const cap = norm(addr.postalCode).replace(/\s+/g, "");

  // Per ora gestiamo bene IT. Estero: trattiamo come mainland (puoi estendere dopo)
  if (country && country !== "IT") return "IT_MAINLAND";

  // 1) Provincia è il metodo più affidabile
  if (province && ISLAND_PROVINCES.has(province)) return "IT_ISLANDS";

  // 2) Fallback CAP (euristica robusta)
  // Sardegna: 07xxx, 08xxx, 09xxx
  // Sicilia: 90xxx - 98xxx
  if (/^\d{5}$/.test(cap)) {
    const prefix2 = cap.slice(0, 2);
    if (prefix2 === "07" || prefix2 === "08" || prefix2 === "09") return "IT_ISLANDS";

    const p = Number(prefix2);
    if (Number.isFinite(p) && p >= 90 && p <= 98) return "IT_ISLANDS";
  }

  return "IT_MAINLAND";
}