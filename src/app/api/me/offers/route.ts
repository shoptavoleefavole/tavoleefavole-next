import { NextRequest, NextResponse } from "next/server";

function nowISO() {
  return new Date().toISOString();
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("tf_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const baseUrlRaw =
      process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL;

    if (!baseUrlRaw) {
      return NextResponse.json(
        { error: "Missing STRAPI_URL env var" },
        { status: 500 }
      );
    }

    const baseUrl = baseUrlRaw.replace(/\/+$/, "");

    // 1) recupero utente
    const meRes = await fetch(`${baseUrl}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!meRes.ok) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const me = await meRes.json();

    // 2) recupero offerte
    const offersRes = await fetch(`${baseUrl}/api/offers?populate=products`, {
      cache: "no-store",
    });

    if (!offersRes.ok) {
      const text = await offersRes.text();
      return NextResponse.json(
        { error: "Cannot load offers", details: text },
        { status: 502 }
      );
    }

    const payload = await offersRes.json();
    const offers = Array.isArray(payload?.data) ? payload.data : [];

    const now = new Date();

    const activeOffers = offers.filter((o: any) => {
      if (o?.onlyForAuthenticated !== true) return false;

      const startAt = o?.startAt ? new Date(o.startAt) : null;
      const endAt = o?.endAt ? new Date(o.endAt) : null;

      if (startAt && now < startAt) return false;
      if (endAt && now > endAt) return false;

      return true;
    });

    return NextResponse.json(
      {
        ok: true,
        me,
        meta: { now: nowISO(), total: activeOffers.length },
        offers: activeOffers,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: "Server error", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}
