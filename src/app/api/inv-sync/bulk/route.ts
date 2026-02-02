import { pushMovementsBulk, type MovementPayload } from "@/lib/inv-sync.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function POST(req: Request) {
  // ✅ Protezione token (Opzione A)
  const expected = mustEnv("INV_SYNC_API_TOKEN");
  const got = req.headers.get("X-INV-SYNC-API-TOKEN");
  if (!got || got !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  // ✅ Leggi body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const movements = body?.movements as MovementPayload[] | undefined;
  if (!Array.isArray(movements) || movements.length === 0) {
    return json({ error: "Body must be { movements: [...] }" }, 400);
  }

  try {
    const result = await pushMovementsBulk(movements);
    return json(result, 200);
  } catch (e: any) {
    return json({ error: e?.message ?? "Unknown error" }, 500);
  }
}

// GET utile per test veloce da browser
export async function GET() {
  return json({ ok: true, hint: "Use POST with X-INV-SYNC-API-TOKEN" }, 200);
}
