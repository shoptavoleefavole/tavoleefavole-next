import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      Vary: "Cookie",
      "x-favorite-route": "v4",
    },
  });
}

function strapiBaseUrl() {
  return (process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337").replace(/\/+$/, "");
}

// ✅ IMPORTANTISSIMO: cookies() va awaitato
async function getUserJwt() {
  const store = await cookies();
  return store.get("tf_token")?.value ?? null;
}

async function fetchJson(url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const text = await res.text().catch(() => "");
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { res, data, text };
}

// Se hai un API token server-to-server lo usa, altrimenti usa il JWT utente
function strapiBearer(userJwt: string) {
  return process.env.STRAPI_API_TOKEN || userJwt;
}

async function getMe(baseUrl: string, userJwt: string) {
  const { res, data } = await fetchJson(`${baseUrl}/api/users/me`, {
    headers: { Authorization: `Bearer ${userJwt}` },
  });
  if (!res.ok) return null;
  return data;
}

function devDetails(data: any, text: string) {
  return process.env.NODE_ENV === "production" ? undefined : (data ?? text);
}

function isNumericId(v: string) {
  return /^\d+$/.test(v);
}

function productFilterParam(productKey: string) {
  // Strapi 5: spesso il prodotto è identificato dal documentId (stringa)
  // Strapi 4: spesso è un id numerico
  if (isNumericId(productKey)) {
    return `filters[product][id][$eq]=${encodeURIComponent(productKey)}`;
  }
  return `filters[product][documentId][$eq]=${encodeURIComponent(productKey)}`;
}

function pickProduct(prod: any) {
  const entity = prod?.data ?? prod;
  const a = entity?.attributes ?? entity ?? {};

  const docId = entity?.documentId ?? a?.documentId ?? null;
  const numId = entity?.id ?? a?.id ?? null;

  // ✅ preferisci documentId (Strapi 5)
  const id = docId ?? numId ?? null;

  return {
    id,
    name: String(a?.name ?? a?.Titolo ?? a?.title ?? "").trim(),
    slug: String(a?.slug ?? "").trim(),
    price: typeof a?.price === "number" ? a.price : Number(a?.price ?? 0),
  };
}

/**
 * GET /api/account/favorite
 */
export async function GET() {
  const baseUrl = strapiBaseUrl();
  const userJwt = await getUserJwt();
  if (!userJwt) return json({ ok: false, error: "Not logged in" }, 401);

  const me = await getMe(baseUrl, userJwt);
  if (!me?.id) return json({ ok: false, error: "Cannot load user" }, 401);

  const url =
    `${baseUrl}/api/favorites` +
    `?filters[user][id][$eq]=${encodeURIComponent(String(me.id))}` +
    `&populate[product]=true` +
    `&sort=createdAt:desc` +
    `&pagination[pageSize]=100`;

  const { res, data, text } = await fetchJson(url, {
    headers: { Authorization: `Bearer ${strapiBearer(userJwt)}` },
  });

  if (!res.ok) {
    const status = res.status;
    const msg =
      status === 401 ? "Non autorizzato (token non valido o scaduto)" :
      status === 403 ? "Permessi Strapi: abilita Favorites per Authenticated" :
      "Favorites fetch failed";

    return json({ ok: false, error: msg, status, details: devDetails(data, text) }, status);
  }

  const rows: any[] = Array.isArray(data?.data) ? data.data : [];

  const favorites = rows
    .map((row) => {
      const favId =
        row?.id ?? row?.documentId ?? row?.attributes?.id ?? row?.attributes?.documentId ?? null;

      const a = row?.attributes ?? row ?? {};
      const prodRaw = a?.product;

      if (!prodRaw) return null;

      const product = pickProduct(prodRaw);
      if (!product?.id || !product?.name || !product?.slug) return null;

      return { id: favId, product };
    })
    .filter(Boolean);

  return json({ ok: true, favorites }, 200);
}

/**
 * POST /api/account/favorite
 * body: { productId }  <-- può essere id numerico o documentId
 */
export async function POST(req: Request) {
  const baseUrl = strapiBaseUrl();
  const userJwt = await getUserJwt();
  if (!userJwt) return json({ ok: false, error: "Not logged in" }, 401);

  const me = await getMe(baseUrl, userJwt);
  if (!me?.id) return json({ ok: false, error: "Cannot load user" }, 401);

  const body = await req.json().catch(() => null);
  const productIdRaw = body?.productId;
  const productKey = String(productIdRaw ?? "").trim();
  if (!productKey) return json({ ok: false, error: "Missing productId" }, 400);

  const b = strapiBearer(userJwt);

  // ✅ anti-duplicato: filtro su product.id se numerico, altrimenti product.documentId
  const checkUrl =
    `${baseUrl}/api/favorites` +
    `?filters[user][id][$eq]=${encodeURIComponent(String(me.id))}` +
    `&${productFilterParam(productKey)}` +
    `&pagination[pageSize]=1`;

  const check = await fetchJson(checkUrl, { headers: { Authorization: `Bearer ${b}` } });
  if (check.res.ok && Array.isArray(check.data?.data) && check.data.data.length > 0) {
    return json({ ok: true, created: false }, 200);
  }

  // ✅ relazione product: in Strapi 5 si può passare direttamente il documentId (stringa) :contentReference[oaicite:1]{index=1}
  const create = await fetchJson(`${baseUrl}/api/favorites`, {
    method: "POST",
    headers: { Authorization: `Bearer ${b}`, "Content-Type": "application/json" },
    body: JSON.stringify({ data: { user: me.id, product: productKey } }),
  });

  if (!create.res.ok) {
    return json(
      { ok: false, error: "Create favorite failed", status: create.res.status, details: devDetails(create.data, create.text) },
      create.res.status
    );
  }

  return json({ ok: true, created: true }, 200);
}

/**
 * DELETE /api/account/favorite?productId=...
 * productId può essere id numerico o documentId
 */
export async function DELETE(req: Request) {
  const baseUrl = strapiBaseUrl();
  const userJwt = await getUserJwt();
  if (!userJwt) return json({ ok: false, error: "Not logged in" }, 401);

  const me = await getMe(baseUrl, userJwt);
  if (!me?.id) return json({ ok: false, error: "Cannot load user" }, 401);

  const { searchParams } = new URL(req.url);
  const productIdRaw = searchParams.get("productId");
  const productKey = String(productIdRaw ?? "").trim();
  if (!productKey) return json({ ok: false, error: "Missing productId" }, 400);

  const b = strapiBearer(userJwt);

  const findUrl =
    `${baseUrl}/api/favorites` +
    `?filters[user][id][$eq]=${encodeURIComponent(String(me.id))}` +
    `&${productFilterParam(productKey)}` +
    `&pagination[pageSize]=1`;

  const found = await fetchJson(findUrl, { headers: { Authorization: `Bearer ${b}` } });
  const favId = found.res.ok && Array.isArray(found.data?.data) ? found.data.data[0]?.id : null;

  if (!favId) return json({ ok: true, deleted: false }, 200);

  const del = await fetchJson(`${baseUrl}/api/favorites/${favId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${b}` },
  });

  if (!del.res.ok) {
    return json(
      { ok: false, error: "Delete favorite failed", status: del.res.status, details: devDetails(del.data, del.text) },
      del.res.status
    );
  }

  return json({ ok: true, deleted: true }, 200);
}
