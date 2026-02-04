import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const json = (data: any, status = 200) =>
    NextResponse.json(data, {
      status,
      headers: { "Cache-Control": "no-store", "x-cialde-upload": "v4" },
    });

  const cleanSecret = (v: string) => {
    let s = String(v ?? "").trim();
    // rimuove virgolette singole/doppie se presenti
    s = s.replace(/^["'](.+)["']$/, "$1");
    // se qualcuno ha incollato "Bearer xxx", togliamo Bearer
    s = s.replace(/^Bearer\s+/i, "");
    return s.trim();
  };

  const pickEnv = (names: string[]) => {
    for (const name of names) {
      const raw = process.env[name];
      if (typeof raw === "string" && raw.trim().length > 0) {
        return { value: cleanSecret(raw), name };
      }
    }
    return { value: "", name: "" };
  };

  const normalizeBaseUrl = (raw: string) => {
    let base = String(raw || "").trim();
    if (!base) base = "http://localhost:1337";
    base = base.replace(/\/+$/, "");
    base = base.replace(/\/api\/?$/, "");
    try {
      // eslint-disable-next-line no-new
      new URL(base);
    } catch {
      return { ok: false as const, base: "", error: `STRAPI_URL non valida: "${raw}"` };
    }
    return { ok: true as const, base };
  };

  const safeParseJson = (text: string) => {
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  };

  try {
    const { value: STRAPI_URL_RAW } = pickEnv(["STRAPI_URL", "NEXT_PUBLIC_STRAPI_URL"]);
    const { ok: baseOk, base, error: baseErr } = normalizeBaseUrl(STRAPI_URL_RAW);

    if (!baseOk) {
      return json({ ok: false, error: baseErr, details: { STRAPI_URL_RAW } }, 500);
    }

    const tokenPick = pickEnv([
      "STRAPI_API_TOKEN",
      "STRAPI_TOKEN",
      "NEXT_PUBLIC_STRAPI_API_TOKEN",
      "NEXT_PUBLIC_STRAPI_TOKEN",
    ]);

    const STRAPI_TOKEN = tokenPick.value;

    if (!STRAPI_TOKEN || STRAPI_TOKEN.length < 10) {
      return json(
        {
          ok: false,
          error: "Config mancante: token Strapi non presente o troppo corto.",
          details: {
            expectedOneOf: ["STRAPI_API_TOKEN", "STRAPI_TOKEN"],
            found: tokenPick.name || null,
            tokenLength: STRAPI_TOKEN ? STRAPI_TOKEN.length : 0,
          },
        },
        500
      );
    }

    const ct = req.headers.get("content-type") || "";
    if (!ct.toLowerCase().includes("multipart/form-data")) {
      return json({ ok: false, error: "Richiesta non valida: serve multipart/form-data.", details: { ct } }, 400);
    }

    const form = await req.formData();
    const files = form.getAll("files");
    const fallbackFile = form.get("file");
    const incoming = (files && files.length > 0 ? files : fallbackFile ? [fallbackFile] : []) as any[];

    if (!incoming.length) return json({ ok: false, error: "Nessun file ricevuto (campo 'files')." }, 400);

    const MAX_FILES = 3;
    const MAX_FILE_MB = 10;
    const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

    if (incoming.length > MAX_FILES) {
      return json({ ok: false, error: `Troppi file: max ${MAX_FILES}.`, details: { count: incoming.length } }, 400);
    }

    const forward = new FormData();

    for (const f of incoming) {
      const name = (f as any)?.name ? String((f as any).name) : "upload";
      const type = String((f as any)?.type || "");
      const size = Number((f as any)?.size ?? 0);

      if (!type.startsWith("image/")) {
        return json({ ok: false, error: "Consentite solo immagini (image/*).", details: { name, type } }, 400);
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    let res: Response;
    let text = "";

    try {
      res = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRAPI_TOKEN}`,
          Accept: "application/json",
        },
        body: forward,
        cache: "no-store",
        signal: controller.signal,
      });
      text = await res.text().catch(() => "");
    } finally {
      clearTimeout(timeout);
    }

    const parsed = safeParseJson(text);

    if (!res.ok) {
      const msg =
        (parsed as any)?.error?.message ||
        (parsed as any)?.message ||
        (parsed as any)?.error ||
        `Upload Strapi fallito (HTTP ${res.status})`;

      const isAuth = res.status === 401 || res.status === 403;

      return json(
        {
          ok: false,
          error: msg,
          status: res.status,
          hint: isAuth
            ? "Token errato/non di questa istanza Strapi o senza accesso. Crea un API Token su Strapi onrender con Full access e incollalo in STRAPI_API_TOKEN (senza virgolette, senza 'Bearer ')."
            : undefined,
          details: {
            strapi: { base, uploadUrl },
            token: { source: tokenPick.name || null, length: STRAPI_TOKEN.length },
            response: parsed ?? { raw: text?.slice(0, 1200) },
          },
        },
        res.status
      );
    }

    if (!parsed) {
      return json({ ok: false, error: "Risposta JSON non valida da Strapi.", details: { raw: text?.slice(0, 1200) } }, 502);
    }

    const first = Array.isArray(parsed)
      ? parsed[0]
      : Array.isArray((parsed as any)?.data)
        ? (parsed as any).data[0]
        : parsed;

    const urlRaw = (first as any)?.url || (first as any)?.data?.attributes?.url || (first as any)?.attributes?.url || null;
    const url = typeof urlRaw === "string" ? urlRaw.trim() : null;

    if (!url) return json({ ok: false, error: "Upload ok ma URL mancante.", details: { parsed: first } }, 502);

    const absolute =
      url.startsWith("http://") || url.startsWith("https://")
        ? url
        : `${base}${url.startsWith("/") ? "" : "/"}${url}`;

    return json({ ok: true, url: absolute }, 200);
  } catch (e: any) {
    const isAbort = e?.name === "AbortError";
    return NextResponse.json(
      { ok: false, error: isAbort ? "Timeout upload verso Strapi." : e?.message ? String(e.message) : "Errore upload." },
      { status: isAbort ? 504 : 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
