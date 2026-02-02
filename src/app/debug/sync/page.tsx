import { redirect } from "next/navigation";
import { getAvailability } from "@/lib/inv-availability.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function makeReference() {
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, "");
  return `SYNC_UI_${ts}`;
}

type DebugSearchParams = { ref?: string };

export default async function DebugSyncPage({
  searchParams,
}: {
  // ✅ Next 15 types: searchParams è tipizzato come Promise
  searchParams?: Promise<DebugSearchParams>;
}) {
  // ✅ Solo in development
  if (process.env.NODE_ENV !== "development") {
    return <main style={{ padding: 24 }}>Not found</main>;
  }

  // ✅ await funziona anche se fosse undefined
  const sp = (await searchParams) ?? {};
  const lastRef: string | undefined = sp.ref;

  // ✅ Server Action: invia +1 SOLO quando premi il bottone
  async function runAdjustIn() {
    "use server";

    const token = process.env.INV_SYNC_API_TOKEN;
    if (!token) throw new Error("Missing env: INV_SYNC_API_TOKEN");

    const reference = makeReference();

    const res = await fetch("http://localhost:3000/api/inv-sync/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-INV-SYNC-API-TOKEN": token,
      },
      cache: "no-store",
      body: JSON.stringify({
        movements: [
          {
            reference,
            type: "ADJUST",
            quantity: 1,
            warehouse: "MAIN",
            sku: "TEST-SKU-001",
            adjustDirection: "IN",
            note: "debug sync +1 (button via Next API)",
          },
        ],
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Bulk call failed: ${res.status} ${res.statusText} | ${text}`);
    }

    redirect(`/debug/sync?ref=${encodeURIComponent(reference)}`);
  }

  // ✅ Leggi disponibilità (non invia nulla)
  let availability: any = null;
  let error: string | null = null;

  try {
    availability = await getAvailability({ skus: ["TEST-SKU-001"], warehouse: "MAIN" });
  } catch (e: any) {
    error = e?.message ?? String(e);
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Debug Inventory Sync</h1>

      <div style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
        <div>
          <b>SKU</b>: TEST-SKU-001
        </div>
        <div>
          <b>Warehouse</b>: MAIN
        </div>

        {lastRef && (
          <div style={{ marginTop: 10 }}>
            <b>Ultima reference inviata</b>: {lastRef}
          </div>
        )}

        <div style={{ marginTop: 8, color: "#444" }}>
          Nota: questa pagina <b>NON</b> invia movimenti al refresh. Usa il bottone.
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 16, padding: 16, border: "1px solid #f99", borderRadius: 12 }}>
          <b>ERRORE</b>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{error}</pre>
        </div>
      )}

      <div style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Availability</h2>
        <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{JSON.stringify(availability, null, 2)}</pre>
      </div>

      <div style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Esegui test</h2>

        <form action={runAdjustIn} style={{ marginTop: 12 }}>
          <button
            type="submit"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Esegui test +1 (ADJUST IN)
          </button>
        </form>
      </div>
    </main>
  );
}
