// src/lib/strapi.ts
export const STRAPI_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  process.env.STRAPI_URL ||
  "http://localhost:1337";

type StrapiFetchOptions = RequestInit & {
  revalidate?: number; // seconds
};

export async function strapiFetch<T>(
  path: string,
  opts: StrapiFetchOptions = {}
): Promise<T> {
  const url = `${STRAPI_URL.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };

  const token = process.env.STRAPI_API_TOKEN || process.env.NEXT_PUBLIC_STRAPI_API_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    ...opts,
    headers,
    next: { revalidate: opts.revalidate ?? 30 },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Strapi fetch failed ${res.status} ${res.statusText} on ${url}\n${body}`);
  }

  return (await res.json()) as T;
}

export function absMediaUrl(maybeUrl: string | null | undefined) {
  if (!maybeUrl) return null;
  const u = String(maybeUrl).trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${STRAPI_URL.replace(/\/$/, "")}${u}`;
  return u;
}
