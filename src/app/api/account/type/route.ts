// src/app/api/account/type/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRAPI_URL = (
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  process.env.STRAPI_URL ||
  "http://localhost:1337"
).replace(/\/+$/, "");

const STRAPI_TOKEN =
  process.env.STRAPI_API_TOKEN ||
  process.env.STRAPI_TOKEN ||
  process.env.NEXT_PUBLIC_STRAPI_API_TOKEN ||
  process.env.NEXT_PUBLIC_STRAPI_TOKEN ||
  "";

function safeJson(text: string) {
  try { return JSON.parse(text); } catch { return null; }
}

async function fetchT(url: string, init: RequestInit, ms = 8_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const tf = cookieStore.get("tf_token")?.value ?? "";

    if (!tf || !STRAPI_TOKEN) {
      return NextResponse.json({ ok: true, loggedIn: false, customerType: null });
    }

    // Step 1 — verifica il JWT e ottieni userId
    const r1 = await fetchT(`${STRAPI_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${tf}`, Accept: "application/json" },
    });

    if (!r1.ok) {
      return NextResponse.json({ ok: true, loggedIn: false, customerType: null });
    }

    const me = safeJson(await r1.text().catch(() => ""));
    const userId = typeof me?.id === "number" ? me.id : null;

    if (!userId) {
      return NextResponse.json({ ok: true, loggedIn: false, customerType: null });
    }

    // Step 2 — cerca il CustomerProfile per questo userId
    const qs = new URLSearchParams();
    qs.set("filters[user][id][$eq]", String(userId));
    qs.set("fields[0]", "customerType");
    qs.set("pagination[pageSize]", "1");

    const r2 = await fetchT(
      `${STRAPI_URL}/api/customer-profiles?${qs.toString()}`,
      { headers: { Authorization: `Bearer ${STRAPI_TOKEN}`, Accept: "application/json" } }
    );

    if (!r2.ok) {
      return NextResponse.json({ ok: true, loggedIn: true, customerType: null });
    }

    const data = safeJson(await r2.text().catch(() => ""));
    const rows: any[] = Array.isArray(data?.data) ? data.data : [];

    let customerType: string | null = null;

    if (rows.length > 0) {
      customerType = String(
        rows[0]?.customerType ?? rows[0]?.attributes?.customerType ?? ""
      ).toUpperCase() || null;
    } else {
      // Fallback: scan di tutti i profili (workaround bug Strapi v5)
      const qsAll = new URLSearchParams();
      qsAll.set("fields[0]", "customerType");
      qsAll.set("populate[user][fields][0]", "id");
      qsAll.set("pagination[pageSize]", "50");

      const r3 = await fetchT(
        `${STRAPI_URL}/api/customer-profiles?${qsAll.toString()}`,
        { headers: { Authorization: `Bearer ${STRAPI_TOKEN}`, Accept: "application/json" } }
      );

      if (r3.ok) {
        const dataAll = safeJson(await r3.text().catch(() => ""));
        const allRows: any[] = Array.isArray(dataAll?.data) ? dataAll.data : [];

        const matched = allRows.find((row: any) => {
          const attrs = row?.attributes ?? row ?? {};
          const relUser = attrs?.user?.data ?? attrs?.user ?? null;
          const relId = relUser?.id ?? relUser?.data?.id ?? null;
          return Number(relId) === userId;
        });

        if (matched) {
          customerType = String(
            matched?.customerType ?? matched?.attributes?.customerType ?? ""
          ).toUpperCase() || null;
        }
      }
    }

    return NextResponse.json(
      { ok: true, loggedIn: true, customerType },
      { headers: { "Cache-Control": "no-store", Vary: "Cookie" } }
    );
  } catch {
    return NextResponse.json({ ok: true, loggedIn: false, customerType: null });
  }
}
