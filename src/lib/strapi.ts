// src/lib/strapi.ts

export const STRAPI_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  process.env.STRAPI_URL ||
  "http://localhost:1337";

export type StrapiAuthMode = "auto" | "none" | "force";

export type StrapiFetchOptions = Omit<RequestInit, "next"> & {
  /** Revalidate (ISR) in seconds. Default 30. If 0 => no-store. */
  revalidate?: number;
  /**
   * auth:
   * - "auto"  (default): adds Bearer token if available
   * - "none": never sends Authorization (for public content)
   * - "force": requires token; throws if missing
   */
  auth?: StrapiAuthMode;
};

/** Normalizza base url togliendo eventuale slash finale */
function baseUrl() {
  return String(STRAPI_URL || "").trim().replace(/\/$/, "");
}

/** Concatena base + path in modo sicuro */
function joinUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl()}${p}`;
}

/** Token: supporta più nomi env (Vercel/locale) */
function getStrapiToken() {
  const t =
    process.env.STRAPI_API_TOKEN ||
    process.env.STRAPI_TOKEN ||
    process.env.NEXT_PUBLIC_STRAPI_API_TOKEN ||
    process.env.NEXT_PUBLIC_STRAPI_TOKEN;

  return t?.trim();
}

export async function strapiFetch<T>(
  path: string,
  opts: StrapiFetchOptions = {}
): Promise<T> {
  const url = joinUrl(path);

  // estraiamo i campi custom per NON farli finire nello spread di fetch()
  const {
    revalidate: revalidateOpt,
    auth: authOpt,
    ...init
  } = opts;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };

  // Se mando un body e manca Content-Type, imposto JSON
  if (!headers["Content-Type"] && init.body) {
    headers["Content-Type"] = "application/json";
  }

  // auth handling
  const authMode: StrapiAuthMode = authOpt ?? "auto";
  const token = getStrapiToken();

  if (authMode !== "none") {
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    } else if (authMode === "force") {
      throw new Error(`Strapi token missing (auth="force") for ${url}`);
    }
  }

  // caching / ISR (Next fetch extension)
  const revalidate = revalidateOpt ?? 30;

  const fetchInit: RequestInit & {
    next?: { revalidate?: number | false };
  } = {
    ...init,
    headers,
  };

  if (revalidate === 0) {
    fetchInit.cache = "no-store";
  } else {
    fetchInit.next = { revalidate };
  }

  const res = await fetch(url, fetchInit);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const shortBody = text.length > 800 ? text.slice(0, 800) + "..." : text;

    throw new Error(
      `Strapi fetch failed: ${res.status} ${res.statusText}\nURL: ${url}\nAuth: ${authMode} (token ${
        token ? "yes" : "no"
      })\n${shortBody}`
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
