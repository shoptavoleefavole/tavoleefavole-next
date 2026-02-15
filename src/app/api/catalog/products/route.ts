import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRAPI_URL =
  process.env.STRAPI_URL ||
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  "http://localhost:1337";

const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || "";

function normalizedBaseUrl() {
  let base = String(STRAPI_URL || "").trim().replace(/\/+$/, "");
  if (!base) return "";

  const isLocal =
    base.includes("localhost") ||
    base.includes("127.0.0.1") ||
    base.includes("0.0.0.0");

  // evita mixed-content su Vercel: se prod e non local, prova a usare https
  if (process.env.NODE_ENV === "production" && !isLocal) {
    base = base.replace(/^http:\/\//i, "https://");
  }

  return base;
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function absUrl(base: string, maybeUrl: unknown): string | null {
  const u = String(maybeUrl ?? "").trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("//")) return `https:${u}`;
  if (u.startsWith("/")) return `${base}${u}`;
  return `${base}/${u}`;
}

function patchFormats(base: string, formats: any) {
  if (!formats || typeof formats !== "object") return formats;

  const out: any = { ...formats };
  for (const key of Object.keys(out)) {
    const f = out[key];
    if (f && typeof f === "object") {
      const next = { ...f };
      const fixed = absUrl(base, next.url);
      if (fixed) next.url = fixed;
      out[key] = next;
    }
  }
  return out;
}

function patchFileEntity(base: string, node: any) {
  if (!node) return node;
  const a = node?.attributes ?? node ?? {};
  const nextA: any = { ...a };

  const fixedUrl = absUrl(base, nextA.url);
  if (fixedUrl) nextA.url = fixedUrl;

  // ✅ patch formats.*.url
  if (nextA.formats) nextA.formats = patchFormats(base, nextA.formats);

  // mantiene struttura (con attributes) se presente
  return node?.attributes ? { ...node, attributes: nextA } : { ...node, ...nextA };
}

function patchMediaRelation(base: string, media: any) {
  const data = media?.data ?? media;
  if (!data) return media;

  if (Array.isArray(data)) {
    const patched = data.map((n) => patchFileEntity(base, n));
    return media?.data ? { ...media, data: patched } : patched;
  }

  const patchedSingle = patchFileEntity(base, data);
  return media?.data ? { ...media, data: patchedSingle } : patchedSingle;
}

function pickBestUrlFromMedia(media: any): string | null {
  const data = media?.data ?? media;
  const first = Array.isArray(data) ? data[0] : data;
  if (!first) return null;

  const a = first?.attributes ?? first ?? {};
  const f = a?.formats ?? null;

  return (
    f?.large?.url ??
    f?.medium?.url ??
    f?.small?.url ??
    f?.thumbnail?.url ??
    a?.url ??
    null
  );
}

export async function GET() {
  const base = normalizedBaseUrl();
  if (!base) {
    return NextResponse.json({ data: [], error: "STRAPI_URL missing" }, { status: 200 });
  }

  const qs = new URLSearchParams();
  qs.set("pagination[pageSize]", "200");
  qs.set("sort[0]", "createdAt:desc");

  // campi base
  qs.set("fields[0]", "name");
  qs.set("fields[1]", "slug");
  qs.set("fields[2]", "price");
  qs.set("fields[3]", "compareAtPrice");
  qs.set("fields[4]", "shortDescription");

  // inventario
  qs.set("fields[5]", "stockQty");
  qs.set("fields[6]", "trackInventory");

  // ✅ immagini: url + formats
  qs.set("populate[images][fields][0]", "url");
  qs.set("populate[images][fields][1]", "formats");

  // (opzionale, ma robusto se in futuro usi un campo singolo)
  qs.set("populate[image][fields][0]", "url");
  qs.set("populate[image][fields][1]", "formats");

  const url = `${base}/api/products?${qs.toString()}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (STRAPI_API_TOKEN) headers.Authorization = `Bearer ${STRAPI_API_TOKEN}`;

  const res = await fetch(url, { headers, cache: "no-store" });

  const text = await res.text().catch(() => "");
  const json = safeJsonParse(text);

  if (!res.ok) {
    return NextResponse.json(
      { data: [], error: `Strapi error ${res.status}`, details: json?.error ?? null },
      { status: 200 }
    );
  }

  const data = Array.isArray(json?.data) ? json.data : [];

  const patched = data.map((row: any) => {
    const a = row?.attributes ?? row ?? {};
    const nextRow: any = { ...row };
    const nextA: any = { ...a };

    nextA.images = patchMediaRelation(base, a?.images);
    nextA.image = patchMediaRelation(base, a?.image);

    // ✅ imageUrl “best” già assoluto
    const bestRaw = pickBestUrlFromMedia(nextA.images) ?? pickBestUrlFromMedia(nextA.image);
    nextA.imageUrl = absUrl(base, bestRaw);

    if (row?.attributes) nextRow.attributes = nextA;
    else Object.assign(nextRow, nextA);

    return nextRow;
  });

  return NextResponse.json({ data: patched, meta: json?.meta ?? {} }, { status: 200 });
}
