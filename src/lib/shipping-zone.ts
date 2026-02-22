// src/lib/shipping-zone.ts
export type ShippingZone = "IT_MAINLAND" | "IT_ISLANDS";

export type ShippingAddress = {
  country?: string | null;
  postalCode?: string | null;
  province?: string | null; // può essere sigla o nome
};

const ISLAND_PROVINCES = new Set([
  // Sicilia
  "AG","CL","CT","EN","ME","PA","RG","SR","TP",
  // Sardegna
  "CA","CI","SU","NU","OR","SS","OG","OT",
]);

const PROVINCE_NAME_TO_CODE: Record<string, string> = {
  // Sicilia
  AGRIGENTO: "AG",
  CALTANISSETTA: "CL",
  CATANIA: "CT",
  ENNA: "EN",
  MESSINA: "ME",
  PALERMO: "PA",
  RAGUSA: "RG",
  SIRACUSA: "SR",
  TRAPANI: "TP",
  // Sardegna
  CAGLIARI: "CA",
  SASSARI: "SS",
  NUORO: "NU",
  ORISTANO: "OR",
  "SUD SARDEGNA": "SU",
  OLBIA: "SS",
  TEMPIO: "SS",
  CARBONIA: "SU",
  IGLESIAS: "SU",
  OGLIASTRA: "NU",
};

function norm(v: any) {
  return String(v ?? "").trim();
}

function normalizeProvinceToCode(prov: string) {
  const p = norm(prov).toUpperCase();
  if (!p) return "";
  if (p.length <= 3) return p;
  const mapped = PROVINCE_NAME_TO_CODE[p];
  return mapped || p;
}

export function computeShippingZoneFromAddress(addr: ShippingAddress): ShippingZone {
  const country = norm(addr.country || "IT").toUpperCase();
  const provinceRaw = norm(addr.province);
  const province = normalizeProvinceToCode(provinceRaw);
  const cap = norm(addr.postalCode).replace(/\s+/g, "");

  if (country && country !== "IT") return "IT_MAINLAND";

  if (province && ISLAND_PROVINCES.has(province)) return "IT_ISLANDS";

  if (/^\d{5}$/.test(cap)) {
    const prefix2 = cap.slice(0, 2);
    if (prefix2 === "07" || prefix2 === "08" || prefix2 === "09") return "IT_ISLANDS";
    const p = Number(prefix2);
    if (Number.isFinite(p) && p >= 90 && p <= 98) return "IT_ISLANDS";
  }

  return "IT_MAINLAND";
}