// src/lib/strapi.ts

export const STRAPI_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  process.env.STRAPI_URL ||
  "http://localhost:1337";

type StrapiFetchOptions = RequestInit & {
  /** Revalidate (ISR) in seconds. If undefined uses default 30. If 0 => no-store. */
  revalidate?: number;
};

/** Normalizza base url togliendo eventuale slash finale */
function baseUrl() {
  return String(STRAPI_URL || "").replace(/\/$/, "");
}

/** Concatena base + path in modo sicuro */
function joinUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl()}${p}`;
}

/** Token: supporta più nomi env (Vercel/locale) */
function getStrapiToken() {
  return (
    process.env.STRAPI_API_TOKEN ||
    process.env.STRAPI_TOKEN ||
    process.env.NEXT_PUBLIC_STRAPI_API_TOKEN ||
    process.env.NEXT_PUBLIC_STRAPI_TOKEN
  );
}

export async function strapiFetch<T>(
  path: string,
  opts: StrapiFetchOptions = {}
): Promise<T> {
  const url = joinUrl(path);

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };

  // Se mando un body string/JSON, spesso serve Content-Type
  if (!headers["Content-Type"] && opts.body) {
    headers["Content-Type"] = "application/json";
  }

  const token = getStrapiToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  // revalidate: 0 => no-store (utile per debug)
  const revalidate = opts.revalidate ?? 30;
  const nextOpt =
    revalidate === 0 ? undefined : { revalidate: revalidate as number };

  const res = await fetch(url, {
    ...opts,
    headers,
    ...(revalidate === 0 ? { cache: "no-store" } : {}),
    ...(nextOpt ? { next: nextOpt } : {}),
  });

  if (!res.ok) {
    let body = "";
    try {
      body = await res.text();
    } catch {
      body = "";
    }
    // Taglia risposta troppo lunga per non “sporcare” i log
    const shortBody = body.length > 800 ? body.slice(0, 800) + "..." : body;

    throw new Error(
      `Strapi fetch failed: ${res.status} ${res.statusText}\nURL: ${url}\n${shortBody}`
    );
  }

  return (await res.json()) as T;
}

/** Rende assoluto un URL Strapi (media o altro) */
export function absStrapiUrl(url?: string | null) {
  if (!url) return null;
  const u = String(url).trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${baseUrl()}${u}`;
  return u;
}

/** Compat: media url */
export function absMediaUrl(maybeUrl: string | null | undefined) {
  return absStrapiUrl(maybeUrl);
}
