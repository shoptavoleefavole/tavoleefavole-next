import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const store = await cookies();

  // cancella cookie auth
  store.set("tf_token", "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    expires: new Date(0),
  });

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store", "Vary": "Cookie" } }
  );
}
