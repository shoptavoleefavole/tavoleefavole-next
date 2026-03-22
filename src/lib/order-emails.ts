import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "";
const SITE_URL = (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

type OrderEmailItem = {
  name?: string | null;
  qty?: number | null;
  price?: number | null;
};

type ShippingAddress = {
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  province?: string | null;
  country?: string | null;
};

export type OrderConfirmationEmailInput = {
  to: string;
  orderLabel: string;
  items: OrderEmailItem[];
  subtotal?: number | null;
  discountTotal?: number | null;
  shippingTotal?: number | null;
  total?: number | null;
  currency?: string | null;
  shippingAddress?: ShippingAddress | null;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function isValidEmail(email: string) {
  if (!email || email.length > 254) return false;
  if (/\s/.test(email)) return false;
  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@")) return false;
  const domain = email.slice(at + 1);
  if (!domain || !domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) return false;
  return true;
}

function formatMoney(amount: number | null | undefined, currency?: string | null) {
  const n = Number(amount ?? 0);
  const safeCurrency = String(currency || "EUR").toUpperCase();

  if (!Number.isFinite(n)) return "-";

  try {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: safeCurrency,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${safeCurrency}`;
  }
}

function buildShippingAddressBlock(address?: ShippingAddress | null) {
  if (!address) return "";

  const parts = [
    address.address,
    [address.postalCode, address.city].filter(Boolean).join(" "),
    address.province,
    address.country,
  ]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);

  if (!parts.length) return "";

  return `
    <div style="margin-top:24px;padding:16px 18px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;">
      <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:8px;">Indirizzo di spedizione</div>
      <div style="font-size:14px;color:#374151;line-height:1.6;">
        ${parts.map((x) => `<div>${escapeHtml(x)}</div>`).join("")}
      </div>
    </div>
  `;
}

function buildItemsTable(items: OrderEmailItem[], currency?: string | null) {
  const safeItems = Array.isArray(items) ? items : [];

  const rows = safeItems
    .map((item) => {
      const name = escapeHtml(item?.name || "Articolo");
      const qty = Math.max(1, Math.floor(Number(item?.qty ?? 1) || 1));
      const price = Number(item?.price ?? 0);

      return `
        <tr>
          <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;">${name}</td>
          <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;text-align:center;">${qty}</td>
          <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;text-align:right;">${escapeHtml(formatMoney(price, currency))}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:24px;">
      <thead>
        <tr>
          <th align="left" style="padding:12px 10px;background:#f3f4f6;border-bottom:1px solid #d1d5db;font-size:13px;color:#111827;">Articolo</th>
          <th align="center" style="padding:12px 10px;background:#f3f4f6;border-bottom:1px solid #d1d5db;font-size:13px;color:#111827;">Qtà</th>
          <th align="right" style="padding:12px 10px;background:#f3f4f6;border-bottom:1px solid #d1d5db;font-size:13px;color:#111827;">Prezzo</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `
          <tr>
            <td colspan="3" style="padding:14px 10px;font-size:14px;color:#6b7280;">
              Nessun articolo disponibile nel riepilogo.
            </td>
          </tr>
        `}
      </tbody>
    </table>
  `;
}

export async function sendOrderConfirmationEmail(input: OrderConfirmationEmailInput) {
  const to = normalizeEmail(input?.to);
  if (!isValidEmail(to)) {
    return { ok: false, error: "INVALID_EMAIL" as const };
  }

  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL || !resend) {
    return { ok: false, error: "EMAIL_NOT_CONFIGURED" as const };
  }

  const orderLabel = String(input?.orderLabel || "ordine").trim();
  const currency = String(input?.currency || "EUR").toUpperCase();

  const subject = `Conferma ordine ${orderLabel} - Tavole e Favole`;

  const html = `
<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
      <div style="background:#ffffff;border-radius:18px;padding:28px 22px;box-shadow:0 8px 24px rgba(0,0,0,0.08);">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="margin:0 0 10px 0;font-size:28px;line-height:1.2;color:#111827;">Grazie per il tuo ordine</h1>
          <p style="margin:0;font-size:15px;color:#6b7280;">
            Abbiamo ricevuto correttamente il pagamento.
          </p>
        </div>

        <div style="padding:16px 18px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;">
          <div style="font-size:14px;color:#6b7280;">Numero ordine</div>
          <div style="margin-top:6px;font-size:18px;font-weight:700;color:#111827;">${escapeHtml(orderLabel)}</div>
        </div>

        ${buildItemsTable(input.items, currency)}

        <div style="margin-top:24px;padding:16px 18px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;">
          <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:8px;font-size:14px;color:#374151;">
            <span>Subtotale</span>
            <strong>${escapeHtml(formatMoney(input.subtotal, currency))}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:8px;font-size:14px;color:#374151;">
            <span>Sconto</span>
            <strong>${escapeHtml(formatMoney(input.discountTotal, currency))}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:8px;font-size:14px;color:#374151;">
            <span>Spedizione</span>
            <strong>${escapeHtml(formatMoney(input.shippingTotal, currency))}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;gap:12px;padding-top:10px;border-top:1px solid #d1d5db;font-size:16px;color:#111827;">
            <span><strong>Totale</strong></span>
            <strong>${escapeHtml(formatMoney(input.total, currency))}</strong>
          </div>
        </div>

        ${buildShippingAddressBlock(input.shippingAddress)}

        <div style="margin-top:28px;font-size:14px;line-height:1.7;color:#4b5563;">
          Ti invieremo una seconda email quando l'ordine sarà spedito, con i dettagli della spedizione.
        </div>

        <div style="margin-top:28px;text-align:center;">
          <a href="${escapeHtml(SITE_URL || "#")}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">
            Vai al sito
          </a>
        </div>
      </div>
    </div>
  </body>
</html>`;

  const textItems = (Array.isArray(input.items) ? input.items : [])
    .map((item) => {
      const name = String(item?.name || "Articolo").trim();
      const qty = Math.max(1, Math.floor(Number(item?.qty ?? 1) || 1));
      const price = formatMoney(Number(item?.price ?? 0), currency);
      return `- ${name} x${qty} - ${price}`;
    })
    .join("\n");

  const textAddress = input.shippingAddress
    ? [
        input.shippingAddress.address,
        [input.shippingAddress.postalCode, input.shippingAddress.city].filter(Boolean).join(" "),
        input.shippingAddress.province,
        input.shippingAddress.country,
      ]
        .map((x) => String(x ?? "").trim())
        .filter(Boolean)
        .join(", ")
    : "";

  const text = [
    `Grazie per il tuo ordine ${orderLabel}.`,
    "",
    "Riepilogo articoli:",
    textItems || "- Nessun articolo disponibile",
    "",
    `Subtotale: ${formatMoney(input.subtotal, currency)}`,
    `Sconto: ${formatMoney(input.discountTotal, currency)}`,
    `Spedizione: ${formatMoney(input.shippingTotal, currency)}`,
    `Totale: ${formatMoney(input.total, currency)}`,
    textAddress ? "" : null,
    textAddress ? `Indirizzo di spedizione: ${textAddress}` : null,
    "",
    "Ti invieremo una seconda email quando l'ordine sarà spedito.",
  ]
    .filter((x) => x != null)
    .join("\n");

  const { error, data } = await resend.emails.send({
    from: RESEND_FROM_EMAIL,
    to,
    subject,
    html,
    text,
  });

  console.info("[order-email] sender debug", {
    from: RESEND_FROM_EMAIL,
    to,
    hasApiKey: !!RESEND_API_KEY,
    siteUrl: SITE_URL,
  });

  if (error) {
    console.error("[order-email] Resend error:", error);
    return { ok: false, error: "RESEND_ERROR" as const, details: error };
  }

  return { ok: true, data };
}