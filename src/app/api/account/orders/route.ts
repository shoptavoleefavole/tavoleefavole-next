import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUTH_COOKIE = "tf_token";
const AUTH_COOKIE_FALLBACK = "jwtToken";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Vary": "Cookie",
      "x-orders-route": "v4-robust",
    },
  });
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function strapiBaseUrl() {
  return (process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337").replace(/\/+$/, "");
}

async function getUserJwtFromCookies() {
  const store = await cookies(); // Next 15: cookies() è async
  return store.get(AUTH_COOKIE)?.value || store.get(AUTH_COOKIE_FALLBACK)?.value || null;
}

async function fetchWithTimeout(url: string, init: RequestInit, ms = 10_000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

function pickNumericId(v: string | null): number | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function cleanDocId(v: string | null) {
  const s = String(v || "").trim();
  if (!s) return "";
  // evita roba gigante/strana
  if (s.length > 120) return "";
  return s;
}

function toNumOrNull(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function extractOrder(row: any) {
  // Strapi v4: { id, attributes: {...} }
  // Strapi v5: flat
  const a = row?.attributes ?? row ?? {};

  const subtotal = toNumOrNull(a?.subtotal ?? row?.subtotal);
  const shippingTotal = toNumOrNull(a?.shippingTotal ?? row?.shippingTotal ?? a?.shipping ?? row?.shipping);
  const discountTotal = toNumOrNull(a?.discountTotal ?? row?.discountTotal ?? a?.discount ?? row?.discount);

  return {
    id: row?.id ?? a?.id ?? null,
    documentId: a?.documentId ?? row?.documentId ?? null,

    orderStatus: a?.orderStatus ?? row?.orderStatus ?? null,
    total: toNumOrNull(a?.total ?? row?.total),
    currency: a?.currency ?? row?.currency ?? null,
    createdAt: a?.createdAt ?? row?.createdAt ?? null,
    stripeSessionId: a?.stripeSessionId ?? row?.stripeSessionId ?? null,

    // dettaglio
    items: a?.items ?? row?.items ?? null,
    subtotal,
    shippingTotal,
    discountTotal,

    // compat alias (alcuni component li leggono)
    shipping: shippingTotal,
    discount: discountTotal,
  };
}

async function getMeUserId(STRAPI_URL: string, userJwt: string) {
  const meRes = await fetchWithTimeout(
    `${STRAPI_URL}/api/users/me`,
    { headers: { Authorization: `Bearer ${userJwt}` } },
    10_000
  );

  const meText = await meRes.text().catch(() => "");
  const meJson = safeJsonParse(meText);

  if (!meRes.ok) {
    return {
      ok: false as const,
      status: 401,
      error: "Unauthorized (users/me)",
      details: process.env.NODE_ENV === "production" ? undefined : (meJson ?? meText),
    };
  }

  const idRaw = meJson?.id;
  let userId: number | null = null;

  if (typeof idRaw === "number") userId = idRaw;
  if (typeof idRaw === "string" && /^\d+$/.test(idRaw)) userId = Number(idRaw);

  if (!userId) {
    return { ok: false as const, status: 500, error: "Could not determine user id" };
  }

  return { ok: true as const, userId };
}

function authHint(status: number, hasApiToken: boolean) {
  if (!hasApiToken && (status === 401 || status === 403)) {
    return "Manca STRAPI_API_TOKEN (consigliato) oppure abilita Order.find per Authenticated in Strapi.";
  }
  return undefined;
}

async function fetchOrdersFromStrapi(STRAPI_URL: string, bearer: string, qs: URLSearchParams) {
  const url = `${STRAPI_URL}/api/orders?${qs.toString()}`;

  const res = await fetchWithTimeout(
    url,
    { headers: { Authorization: `Bearer ${bearer}` } },
    10_000
  );

  const text = await res.text().catch(() => "");
  const payload = safeJsonParse(text);

  return { res, text, payload };
}

export async function GET(req: Request) {
  const STRAPI_URL = strapiBaseUrl();
  const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;
  const hasApiToken = Boolean(STRAPI_API_TOKEN);

  // 1) JWT utente
  const userJwt = await getUserJwtFromCookies();
  if (!userJwt) {
    return json({ ok: false, error: "Not authenticated (missing tf_token)" }, 401);
  }

  // 2) chi è l'utente?
  let userId: number;
  try {
    const me = await getMeUserId(STRAPI_URL, userJwt);
    if (!me.ok) return json({ ok: false, error: me.error, details: me.details }, me.status);
    userId = me.userId;
  } catch (e: any) {
    const isAbort = e?.name === "AbortError";
    return json(
      {
        ok: false,
        error: isAbort ? "Timeout contacting Strapi (users/me)" : "Strapi unreachable (users/me)",
        details: process.env.NODE_ENV === "production" ? undefined : (e?.message ?? String(e)),
      },
      502
    );
  }

  const { searchParams } = new URL(req.url);

  // supporto query per dettaglio:
  // - ?id=NUM
  // - ?orderId=NUM
  // - ?documentId=STRING
  const idParam = pickNumericId(searchParams.get("id") || searchParams.get("orderId"));
  const documentId = cleanDocId(searchParams.get("documentId"));

  // token server-to-server preferito
  const bearer = STRAPI_API_TOKEN || userJwt;

  // --- DETTAGLIO SINGOLO ORDINE
  if (idParam || documentId) {
    // IMPORTANTISSIMO: non mettere insieme filtri id+documentId => è AND e rischi 404.
    // Facciamo fallback:
    const attempts: Array<{ mode: "id" | "documentId"; value: string }> = [];
    if (idParam) attempts.push({ mode: "id", value: String(idParam) });
    if (documentId) attempts.push({ mode: "documentId", value: documentId });

    for (const at of attempts) {
      const qs = new URLSearchParams();
      qs.set("pagination[pageSize]", "1");
      qs.set("filters[user][id][$eq]", String(userId));
      qs.set("populate", "*");

      if (at.mode === "id") qs.set("filters[id][$eq]", at.value);
      if (at.mode === "documentId") qs.set("filters[documentId][$eq]", at.value);

      let out: Awaited<ReturnType<typeof fetchOrdersFromStrapi>>;
      try {
        out = await fetchOrdersFromStrapi(STRAPI_URL, bearer, qs);
      } catch (e: any) {
        const isAbort = e?.name === "AbortError";
        return json(
          {
            ok: false,
            error: isAbort ? "Timeout contacting Strapi (orders detail)" : "Strapi unreachable (orders detail)",
            details: process.env.NODE_ENV === "production" ? undefined : (e?.message ?? String(e)),
          },
          502
        );
      }

      const { res, payload, text } = out;

      if (!res.ok) {
        return json(
          {
            ok: false,
            error: "Orders fetch failed on Strapi (detail)",
            status: res.status,
            hint: authHint(res.status, hasApiToken),
            details: process.env.NODE_ENV === "production" ? undefined : (payload ?? text.slice(0, 1500)),
          },
          res.status
        );
      }

      const arr = Array.isArray(payload?.data) ? payload.data : [];
      if (arr[0]) {
        return json({ ok: true, userId, order: extractOrder(arr[0]) }, 200);
      }
      // se vuoto, prova fallback successivo
    }

    return json({ ok: false, error: "Order not found" }, 404);
  }

  // --- LISTA ORDINI
  const qs = new URLSearchParams();
  qs.set("sort[0]", "createdAt:desc");
  qs.set("pagination[pageSize]", "50");
  qs.set("filters[user][id][$eq]", String(userId));
  // niente populate=* in lista: più veloce e meno fragile

  let out: Awaited<ReturnType<typeof fetchOrdersFromStrapi>>;
  try {
    out = await fetchOrdersFromStrapi(STRAPI_URL, bearer, qs);
  } catch (e: any) {
    const isAbort = e?.name === "AbortError";
    return json(
      {
        ok: false,
        error: isAbort ? "Timeout contacting Strapi (orders list)" : "Strapi unreachable (orders list)",
        details: process.env.NODE_ENV === "production" ? undefined : (e?.message ?? String(e)),
      },
      502
    );
  }

  const { res, payload, text } = out;

  if (!res.ok) {
    return json(
      {
        ok: false,
        error: "Orders fetch failed on Strapi (list)",
        status: res.status,
        hint: authHint(res.status, hasApiToken),
        details: process.env.NODE_ENV === "production" ? undefined : (payload ?? text.slice(0, 1500)),
      },
      res.status
    );
  }

  const arr = Array.isArray(payload?.data) ? payload.data : [];
  const orders = arr.map(extractOrder);

  return json({ ok: true, userId, orders }, 200);
}
