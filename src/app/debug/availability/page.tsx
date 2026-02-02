import "server-only";
import { getAvailability } from "@/lib/inventory.server";

export const dynamic = "force-dynamic";

export default async function DebugAvailabilityPage() {
  const sku = "TEST-SKU-001";
  const warehouse = "MAIN";

  const availability = await getAvailability({ skus: [sku], warehouse });

  // Struttura: { data: { MAIN: { [sku]: { onHand, reserved, available } } } }
  const row =
    (availability as any)?.data?.[warehouse]?.[sku] ?? { onHand: 0, reserved: 0, available: 0 };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-extrabold">Debug Availability</h1>

      <div className="mt-4 rounded-2xl border border-border bg-background p-4">
        <div className="text-sm text-text/70">Warehouse</div>
        <div className="text-lg font-bold">{warehouse}</div>

        <div className="mt-3 text-sm text-text/70">SKU</div>
        <div className="text-lg font-bold">{sku}</div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border p-3">
            <div className="text-xs text-text/60">On hand</div>
            <div className="text-xl font-extrabold">{row.onHand}</div>
          </div>
          <div className="rounded-xl border border-border p-3">
            <div className="text-xs text-text/60">Reserved</div>
            <div className="text-xl font-extrabold">{row.reserved}</div>
          </div>
          <div className="rounded-xl border border-border p-3">
            <div className="text-xs text-text/60">Available</div>
            <div className="text-xl font-extrabold">{row.available}</div>
          </div>
        </div>

        <div className="mt-4">
          {(row.available ?? 0) > 0 ? (
            <span className="inline-flex rounded-full border border-border px-3 py-1 text-sm font-semibold">
              Disponibile ✅
            </span>
          ) : (
            <span className="inline-flex rounded-full border border-red-200 px-3 py-1 text-sm font-semibold text-red-600">
              Esaurito ❌
            </span>
          )}
        </div>

        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-semibold">
            Raw JSON (availability)
          </summary>
          <pre className="mt-2 overflow-auto rounded-xl bg-surface-2/60 p-3 text-xs">
            {JSON.stringify(availability, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}

