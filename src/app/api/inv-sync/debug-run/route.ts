import { pushMovementsBulk } from "@/lib/inv-sync.server";

function redirectTo(url: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: url },
  });
}

export async function POST() {
  // SOLO in development
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not found", { status: 404 });
  }

  const reference = `SYNC_UI_${new Date().toISOString().replace(/[-:.TZ]/g, "")}`;

  const movements = [
    {
      reference,
      type: "ADJUST" as const,
      quantity: 1,
      warehouse: "MAIN",
      sku: "TEST-SKU-001",
      adjustDirection: "IN" as const,
      note: "debug sync +1 (button)",
    },
  ];

  // Qui andiamo DIRETTI a Strapi (server-to-server), senza passare dalla route bulk protetta.
  // È solo una scorciatoia debug in dev.
  await pushMovementsBulk(movements);

  // Torna alla pagina debug
  return redirectTo("/debug/sync");
}
