// src/lib/inv-sync.server.ts
import "server-only";

export type MovementType = "ADJUST" | "IN" | "OUT" | "TRANSFER";
export type AdjustDirection = "IN" | "OUT";

export type MovementPayload = {
  reference: string;                 // unique
  type: MovementType;
  quantity: number;                  // >= 1
  warehouse: string;                 // "MAIN"
  sku: string;                       // "TEST-SKU-001"
  adjustDirection?: AdjustDirection; // required if type === "ADJUST"
  note?: string;
};

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function pushMovementsBulk(movements: MovementPayload[]) {
  if (!Array.isArray(movements) || movements.length === 0) {
    throw new Error("pushMovementsBulk: movements array is empty");
  }

  const STRAPI_URL = mustEnv("STRAPI_URL").replace(/\/$/, "");
  const INV_SYNC_SECRET = mustEnv("INV_SYNC_SECRET");

  // minimal validation (client-side)
  for (const m of movements) {
    if (!m.reference) throw new Error("Movement missing reference");
    if (!m.type) throw new Error(`Movement ${m.reference} missing type`);
    if (!Number.isFinite(m.quantity) || m.quantity < 1) {
      throw new Error(`Movement ${m.reference} invalid quantity`);
    }
    if (!m.warehouse) throw new Error(`Movement ${m.reference} missing warehouse`);
    if (!m.sku) throw new Error(`Movement ${m.reference} missing sku`);
    if (m.type === "ADJUST" && !m.adjustDirection) {
      throw new Error(`Movement ${m.reference} missing adjustDirection for ADJUST`);
    }
  }

  const url = `${STRAPI_URL}/api/inv-sync/movements/bulk`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SYNC-SECRET": INV_SYNC_SECRET,
    },
    cache: "no-store",
    body: JSON.stringify({ movements }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Strapi bulk failed: ${res.status} ${res.statusText} | ${text}`);
  }

  // bulk route should return json, but be tolerant:
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
