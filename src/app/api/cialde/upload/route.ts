import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Upload server-side verso Strapi (/api/upload).
 * Env richieste:
 * - STRAPI_URL (es. https://tavoleefavole-strapi.onrender.com)
 * - STRAPI_API_TOKEN (token API Strapi con permesso upload)
 *
 * Note: Render può andare in "sleep" → cold start anche 30-60s.
 */

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "x-cialde-upload": "v5-timeout-retry",
    },
  });
}

function pickEnvToken() {
  const token =
    process.env.STRAPI_API_TOKEN ||
    process.env.STRAPI_TOKEN ||
    process.env.NEXT_PUBLIC_STRAPI_API_TOKEN ||
    process.env.NEXT_PUBLIC_STRAPI_TOKEN ||
    "";
  return token.trim();
}

function pickEnvBaseUrl() {
  const raw =
    process.env.STRAPI_URL ||
    process.env.NEXT_PUBLIC_STRAPI_URL ||
    "http://localhost:1337";
  const base = String(raw || "").replace(/\/+$/, "");
  // validate
  // eslint-disable-next-line no-new
  new URL(base);
  return base;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractUrlFromStrapiResponse(base: string, parsed: any): string | null {
  const first =
    Array.isArray(parsed) ? parsed[0]
    : Array.isArray(parsed?.data) ? parsed.data[0]
    : parsed;

  const urlRaw =
    first?.url ||
    first?.data?.attributes?.url ||
    first?.attributes?.url ||
    null;

  const url = typeof urlRaw === "string" ? urlRaw.trim() : null;
  if (!url) return null;

  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

export async function POST(req: Request) {
  try {
    const base = pickEnvBaseUrl();
    const token = pickEnvToken();

    if (!token || token.length < 20) {
      return json(
        { ok: false, error: "Config mancante: STRAPI_API_TOKEN non valido." },
        500
      );
    }

    const ct = req.headers.get("content-type") || "";
    if (!ct.toLowerCase().includes("multipart/form-data")) {
      return json(
        { ok: false, error: "Richiesta non valida: serve multipart/form-data.", details: { contentType: ct } },
        400
      );
    }

    const form = await req.formData();
    const files = form.getAll("files");
    if (!files || files.length === 0) {
      return json({ ok: false, error: "Nessun file ricevuto (campo 'files')." }, 400);
    }

    // limiti sicurezza
    const MAX_FILES = 3;
    const MAX_FILE_MB = 10;
    const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

    if (files.length > MAX_FILES) {
      return json({ ok: false, error: `Troppi file: max ${MAX_FILES}.` }, 400);
    }

    const forward = new FormData();
    for (const f of files) {
      const name = (f as any)?.name ? String((f as any).name) : "upload";
      const type = String((f as any)?.type || "");
      const size = Number((f as any)?.size ?? 0);

      if (!type.startsWith("image/")) {
        return json(
          { ok: false, error: "Tipo file non valido: solo immagini (image/*).", details: { name, type } },
          400
        );
      }
      if (!Number.isFinite(size) || size <= 0) {
        return json({ ok: false, error: "File non valido o vuoto.", details: { name, size } }, 400);
      }
      if (size > MAX_FILE_BYTES) {
        return json({ ok: false, error: `File troppo grande (max ${MAX_FILE_MB}MB).`, details: { name, size } }, 400);
      }

      forward.append("files", f as any, name);
    }

    const uploadUrl = `${base}/api/upload`;

    // ✅ Timeout alto per cold start Render (default 60s) + retry 1 volta
    const timeoutMs = Number(process.env.STRAPI_UPLOAD_TIMEOUT_MS || 60_000);
    const maxAttempts = 2;

    let lastStatus = 0;
    let lastText = "";

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetchWithTimeout(
          uploadUrl,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
              // NON mettere Content-Type: boundary lo gestisce fetch/FormData
            },
            body: forward,
          },
          timeoutMs
        );

        lastStatus = res.status;
        lastText = await res.text().catch(() => "");

        const parsed = lastText ? safeJsonParse(lastText) : null;

        if (!res.ok) {
          // retry solo su problemi “temporanei”
          const retryable = [502, 503, 504].includes(res.status);
          if (retryable && attempt < maxAttempts) {
            // piccolo backoff
            await new Promise((r) => setTimeout(r, 600));
            continue;
          }

          const msg =
            parsed?.error?.message ||
            parsed?.message ||
            `Upload Strapi fallito (HTTP ${res.status})`;

          return json(
            {
              ok: false,
              error: msg,
              status: res.status,
              details: parsed ?? { raw: lastText.slice(0, 1200) },
              hint:
                res.status === 401
                  ? "Token non valido o senza permessi upload."
                  : "Strapi potrebbe essere in cold-start. Riprova tra pochi secondi.",
            },
            res.status
          );
        }

        if (!parsed) {
          return json(
            { ok: false, error: "Upload riuscito ma risposta JSON non valida.", details: { raw: lastText.slice(0, 1200) } },
            502
          );
        }

        const url = extractUrlFromStrapiResponse(base, parsed);
        if (!url) {
          return json(
            { ok: false, error: "Upload riuscito ma URL file mancante.", details: { parsed } },
            502
          );
        }

        return json({ ok: true, url }, 200);
      } catch (e: any) {
        const isAbort = e?.name === "AbortError";
        // retry su abort
        if ((isAbort || e?.code === "UND_ERR_HEADERS_TIMEOUT") && attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }

        return json(
          {
            ok: false,
            error: isAbort ? "Timeout upload verso Strapi." : "Errore rete upload verso Strapi.",
            status: 504,
            details: e?.message ? String(e.message) : String(e),
            strapi: { uploadUrl },
            hint: "Se Strapi è su Render, può essere in cold-start. Riprova dopo 10–20s o aumenta STRAPI_UPLOAD_TIMEOUT_MS.",
          },
          504
        );
      }
    }

    return json(
      {
        ok: false,
        error: "Upload fallito dopo retry.",
        status: lastStatus || 504,
        details: lastText ? lastText.slice(0, 1200) : null,
      },
      504
    );
  } catch (e: any) {
    return json(
      { ok: false, error: "Upload handler failed", details: e?.message ? String(e.message) : String(e) },
      500
    );
  }
}
