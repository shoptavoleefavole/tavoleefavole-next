import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies(); // ✅ in Next recente è async
  const token = cookieStore.get("tf_token")?.value;

  return NextResponse.json(
    { loggedIn: Boolean(token) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
