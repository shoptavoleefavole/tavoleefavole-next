import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "";
const SITE_URL = (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
const EMAIL_BRAND_BANNER_URL =
  process.env.EMAIL_BRAND_BANNER_URL ??
  (SITE_URL ? `${SITE_URL}/email/insegna-tavole-e-favole.webp` : "");

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const BRAND = {
  fuchsia: "#d12c74",
  fuchsiaDark: "#b31f61",
  aqua: "#49b8b0",
  aquaDark: "#2f8f88",
  ink: "#3f4656",
  muted: "#6b7280",
  bg: "#f8f4f6",
  card: "#ffffff",
  line: "#eadfe5",
  softPink: "#fff2f7",
  softGreen: "#eefaf8",
};

type OrderEmailItem = {
  name?: string | null;
  qty?: number | null;
  price?: number | null;
  basePrice?: number | null;
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

export type ShippingTrackingEmailInput = {
  to: string;
  orderLabel: string;
  trackingNumber: string;
  trackingUrl?: string | null;
  carrier?: string | null;
  items?: OrderEmailItem[] | null;
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

function normalizeUrl(value: unknown) {
  const s = String(value ?? "").trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) return "";
  return s;
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

function buildShippingAddressLines(address?: ShippingAddress | null) {
  if (!address) return [];
  return [
    address.address,
    [address.postalCode, address.city].filter(Boolean).join(" "),
    address.province,
    address.country,
  ]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);
}

function buildShippingAddressBlock(address?: ShippingAddress | null) {
  const parts = buildShippingAddressLines(address);
  if (!parts.length) return "";

  return `
    <div style="margin-top:28px;padding:18px 18px;background:${BRAND.softGreen};border:1px solid ${BRAND.line};border-radius:16px;">
      <div style="font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.aquaDark};margin-bottom:10px;">
        Indirizzo di spedizione
      </div>
      <div style="font-size:14px;color:${BRAND.ink};line-height:1.7;">
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
      const basePrice = Number(item?.basePrice ?? price);
      const hasDiscount = Number.isFinite(basePrice) && basePrice > price;

      return `
        <tr>
          <td style="padding:14px 10px;border-bottom:1px solid ${BRAND.line};font-size:14px;color:${BRAND.ink};vertical-align:top;">
            <div style="font-weight:700;">${name}</div>
          </td>
          <td style="padding:14px 10px;border-bottom:1px solid ${BRAND.line};font-size:14px;color:${BRAND.muted};text-align:center;vertical-align:top;">
            ${qty}
          </td>
          <td style="padding:14px 10px;border-bottom:1px solid ${BRAND.line};font-size:14px;color:${BRAND.ink};text-align:right;vertical-align:top;">
            ${
              hasDiscount
                ? `
                  <div style="font-weight:800;color:${BRAND.fuchsia};">${escapeHtml(formatMoney(price, currency))}</div>
                  <div style="margin-top:3px;font-size:12px;color:${BRAND.muted};text-decoration:line-through;">
                    ${escapeHtml(formatMoney(basePrice, currency))}
                  </div>
                `
                : `<div style="font-weight:700;">${escapeHtml(formatMoney(price, currency))}</div>`
            }
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:26px;">
      <thead>
        <tr>
          <th align="left" style="padding:12px 10px;background:${BRAND.softPink};border-bottom:1px solid ${BRAND.line};font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:${BRAND.ink};">Articolo</th>
          <th align="center" style="padding:12px 10px;background:${BRAND.softPink};border-bottom:1px solid ${BRAND.line};font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:${BRAND.ink};">Qtà</th>
          <th align="right" style="padding:12px 10px;background:${BRAND.softPink};border-bottom:1px solid ${BRAND.line};font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:${BRAND.ink};">Prezzo</th>
        </tr>
      </thead>
      <tbody>
        ${
          rows ||
          `
          <tr>
            <td colspan="3" style="padding:16px 10px;font-size:14px;color:${BRAND.muted};">
              Nessun articolo disponibile nel riepilogo.
            </td>
          </tr>
        `
        }
      </tbody>
    </table>
  `;
}

function buildTotalsBlock(args: {
  subtotal?: number | null;
  discountTotal?: number | null;
  shippingTotal?: number | null;
  total?: number | null;
  currency?: string | null;
}) {
  const currency = String(args.currency || "EUR").toUpperCase();
  const subtotal = Number(args.subtotal ?? 0);
  const discountTotal = Number(args.discountTotal ?? 0);
  const shippingTotal = Number(args.shippingTotal ?? 0);
  const total = Number(args.total ?? 0);
  const hasDiscount = Number.isFinite(discountTotal) && discountTotal > 0;

  return `
    <div style="margin-top:26px;padding:18px;background:${BRAND.bg};border:1px solid ${BRAND.line};border-radius:16px;">
      <div style="font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.aquaDark};margin-bottom:14px;">
        Riepilogo ordine
      </div>

      <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:10px;font-size:14px;color:${BRAND.ink};">
        <span>Subtotale articoli</span>
        <strong>${escapeHtml(formatMoney(subtotal, currency))}</strong>
      </div>

      ${
        hasDiscount
          ? `
        <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:10px;font-size:14px;color:${BRAND.fuchsia};">
          <span>Sconto</span>
          <strong>− ${escapeHtml(formatMoney(discountTotal, currency))}</strong>
        </div>
      `
          : ""
      }

      <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:10px;font-size:14px;color:${BRAND.ink};">
        <span>Spedizione</span>
        <strong>${shippingTotal <= 0 ? "Gratis" : escapeHtml(formatMoney(shippingTotal, currency))}</strong>
      </div>

      <div style="display:flex;justify-content:space-between;gap:12px;padding-top:12px;border-top:1px solid ${BRAND.line};font-size:17px;color:${BRAND.ink};">
        <span><strong>Totale</strong></span>
        <strong style="color:${BRAND.fuchsia};">${escapeHtml(formatMoney(total, currency))}</strong>
      </div>
    </div>
  `;
}

function buildBanner() {
  const bannerUrl = normalizeUrl(EMAIL_BRAND_BANNER_URL);

  if (bannerUrl) {
    return `
      <div style="margin-bottom:24px;">
        <img
          src="${escapeHtml(bannerUrl)}"
          alt="Tavole e Favole"
          width="600"
          style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:18px;"
        />
      </div>
    `;
  }

  return `
    <div style="margin-bottom:24px;padding:22px 24px;border-radius:18px;background:linear-gradient(135deg, ${BRAND.softPink} 0%, ${BRAND.softGreen} 100%);border:1px solid ${BRAND.line};text-align:center;">
      <div style="font-size:34px;line-height:1;font-weight:900;color:${BRAND.fuchsia};letter-spacing:.01em;">
        Tavole e Favole
      </div>
      <div style="margin-top:8px;font-size:13px;color:${BRAND.aquaDark};font-weight:700;letter-spacing:.08em;text-transform:uppercase;">
        Dolci dettagli, momenti da favola
      </div>
    </div>
  `;
}

function buildHero(args: {
  badge: string;
  title: string;
  subtitle: string;
}) {
  return `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:${BRAND.softGreen};color:${BRAND.aquaDark};font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">
        ${escapeHtml(args.badge)}
      </div>
      <h1 style="margin:16px 0 10px 0;font-size:30px;line-height:1.18;color:${BRAND.ink};font-weight:900;">
        ${escapeHtml(args.title)}
      </h1>
      <p style="margin:0;font-size:15px;line-height:1.7;color:${BRAND.muted};">
        ${escapeHtml(args.subtitle)}
      </p>
    </div>
  `;
}

function buildOrderNumberCard(orderLabel: string, extraHtml = "") {
  return `
    <div style="padding:18px;background:${BRAND.card};border:1px solid ${BRAND.line};border-radius:16px;">
      <div style="font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.aquaDark};margin-bottom:8px;">
        Numero ordine
      </div>
      <div style="font-size:20px;font-weight:900;color:${BRAND.ink};">
        ${escapeHtml(orderLabel)}
      </div>
      ${extraHtml}
    </div>
  `;
}

function buildInfoCard(title: string, contentHtml: string) {
  return `
    <div style="margin-top:24px;padding:18px;background:${BRAND.card};border:1px solid ${BRAND.line};border-radius:16px;">
      <div style="font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.aquaDark};margin-bottom:10px;">
        ${escapeHtml(title)}
      </div>
      <div style="font-size:14px;line-height:1.7;color:${BRAND.ink};">
        ${contentHtml}
      </div>
    </div>
  `;
}

function buildButton(href: string, label: string) {
  const url = normalizeUrl(href) || "#";
  return `
    <div style="margin-top:28px;text-align:center;">
      <a
        href="${escapeHtml(url)}"
        style="display:inline-block;padding:14px 22px;border-radius:14px;background:${BRAND.fuchsia};color:#ffffff;text-decoration:none;font-size:14px;font-weight:800;letter-spacing:.01em;"
      >
        ${escapeHtml(label)}
      </a>
    </div>
  `;
}

function buildEmailShell(args: {
  subject: string;
  preheader: string;
  heroHtml: string;
  mainHtml: string;
  footerNote?: string;
}) {
  const footerNote =
    args.footerNote ||
    "Per qualsiasi dubbio o necessità, puoi rispondere a questa email o contattarci dal sito.";

  return `
<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(args.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.bg};font-family:Arial,Helvetica,sans-serif;color:${BRAND.ink};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${escapeHtml(args.preheader)}
    </div>

    <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
      ${buildBanner()}

      <div style="background:${BRAND.card};border:1px solid ${BRAND.line};border-radius:22px;padding:28px 22px;box-shadow:0 12px 32px rgba(209,44,116,0.08);">
        ${args.heroHtml}
        ${args.mainHtml}

        <div style="margin-top:28px;padding-top:18px;border-top:1px solid ${BRAND.line};font-size:12px;line-height:1.8;color:${BRAND.muted};text-align:center;">
          ${escapeHtml(footerNote)}
        </div>
      </div>
    </div>
  </body>
</html>
  `;
}

function buildOrderText(input: OrderConfirmationEmailInput, subject: string) {
  const currency = String(input?.currency || "EUR").toUpperCase();

  const textItems = (Array.isArray(input.items) ? input.items : [])
    .map((item) => {
      const name = String(item?.name || "Articolo").trim();
      const qty = Math.max(1, Math.floor(Number(item?.qty ?? 1) || 1));
      const price = formatMoney(Number(item?.price ?? 0), currency);
      return `- ${name} x${qty} - ${price}`;
    })
    .join("\n");

  const textAddress = buildShippingAddressLines(input.shippingAddress).join(", ");

  return [
    subject,
    "",
    `Ordine: ${input.orderLabel}`,
    "",
    "Riepilogo articoli:",
    textItems || "- Nessun articolo disponibile",
    "",
    `Subtotale articoli: ${formatMoney(input.subtotal, currency)}`,
    `Sconto: ${Number(input.discountTotal ?? 0) > 0 ? `- ${formatMoney(input.discountTotal, currency)}` : formatMoney(0, currency)}`,
    `Spedizione: ${Number(input.shippingTotal ?? 0) > 0 ? formatMoney(input.shippingTotal, currency) : "Gratis"}`,
    `Totale: ${formatMoney(input.total, currency)}`,
    textAddress ? "" : null,
    textAddress ? `Indirizzo di spedizione: ${textAddress}` : null,
    "",
    "Ti invieremo una seconda email quando l'ordine sarà spedito.",
  ]
    .filter((x) => x != null)
    .join("\n");
}

function buildTrackingText(input: ShippingTrackingEmailInput, subject: string) {
  const currency = String(input?.currency || "EUR").toUpperCase();
  const textItems = (Array.isArray(input.items) ? input.items : [])
    .map((item) => {
      const name = String(item?.name || "Articolo").trim();
      const qty = Math.max(1, Math.floor(Number(item?.qty ?? 1) || 1));
      return `- ${name} x${qty}`;
    })
    .join("\n");

  const textAddress = buildShippingAddressLines(input.shippingAddress).join(", ");

  return [
    subject,
    "",
    `Ordine: ${input.orderLabel}`,
    `Corriere: ${input.carrier || "Corriere espresso"}`,
    `Tracking: ${input.trackingNumber}`,
    input.trackingUrl ? `Link tracking: ${input.trackingUrl}` : null,
    "",
    textItems ? "Articoli spediti:" : null,
    textItems || null,
    typeof input.total === "number" ? "" : null,
    typeof input.total === "number" ? `Totale ordine: ${formatMoney(input.total, currency)}` : null,
    textAddress ? "" : null,
    textAddress ? `Destinazione: ${textAddress}` : null,
    "",
    "Il tracking potrebbe attivarsi entro qualche ora dal ritiro del pacco.",
  ]
    .filter((x) => x != null)
    .join("\n");
}

async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL || !resend) {
    return { ok: false, error: "EMAIL_NOT_CONFIGURED" as const };
  }

  const { error, data } = await resend.emails.send({
    from: RESEND_FROM_EMAIL,
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
  });

  console.info("[order-email] sender debug", {
    from: RESEND_FROM_EMAIL,
    to: args.to,
    hasApiKey: !!RESEND_API_KEY,
    siteUrl: SITE_URL,
    hasBanner: !!normalizeUrl(EMAIL_BRAND_BANNER_URL),
  });

  if (error) {
    console.error("[order-email] Resend error:", error);
    return { ok: false, error: "RESEND_ERROR" as const, details: error };
  }

  return { ok: true, data };
}

export async function sendOrderConfirmationEmail(input: OrderConfirmationEmailInput) {
  const to = normalizeEmail(input?.to);
  if (!isValidEmail(to)) {
    return { ok: false, error: "INVALID_EMAIL" as const };
  }

  const orderLabel = String(input?.orderLabel || "ordine").trim();
  const currency = String(input?.currency || "EUR").toUpperCase();
  const subject = `Conferma ordine ${orderLabel} - Tavole e Favole`;

  const html = buildEmailShell({
    subject,
    preheader: `Abbiamo ricevuto il tuo ordine ${orderLabel}.`,
    heroHtml: buildHero({
      badge: "Ordine confermato",
      title: "Grazie per aver scelto Tavole e Favole",
      subtitle: "Abbiamo ricevuto correttamente il pagamento e stiamo già preparando il tuo ordine con la massima cura.",
    }),
    mainHtml: `
      ${buildOrderNumberCard(orderLabel)}
      ${buildItemsTable(input.items, currency)}
      ${buildTotalsBlock({
        subtotal: input.subtotal,
        discountTotal: input.discountTotal,
        shippingTotal: input.shippingTotal,
        total: input.total,
        currency,
      })}
      ${buildShippingAddressBlock(input.shippingAddress)}
      ${buildInfoCard(
        "Prossimi step",
        `
          <div>Riceverai una nuova email non appena il tuo ordine sarà affidato al corriere.</div>
          <div style="margin-top:8px;">Nel frattempo puoi sempre tornare sul sito per continuare i tuoi acquisti o contattarci per assistenza.</div>
        `
      )}
      ${buildButton(SITE_URL || "#", "Vai al sito")}
    `,
  });

  const text = buildOrderText(input, subject);
  return sendEmail({ to, subject, html, text });
}

export async function sendShippingTrackingEmail(input: ShippingTrackingEmailInput) {
  const to = normalizeEmail(input?.to);
  if (!isValidEmail(to)) {
    return { ok: false, error: "INVALID_EMAIL" as const };
  }

  const orderLabel = String(input?.orderLabel || "ordine").trim();
  const trackingNumber = String(input?.trackingNumber || "").trim();
  if (!trackingNumber) {
    return { ok: false, error: "INVALID_TRACKING_NUMBER" as const };
  }

  const currency = String(input?.currency || "EUR").toUpperCase();
  const carrier = String(input?.carrier || "Corriere espresso").trim();
  const trackingUrl = normalizeUrl(input?.trackingUrl);
  const subject = `Il tuo ordine ${orderLabel} è stato spedito - Tavole e Favole`;

  const trackingCardHtml = `
    ${buildOrderNumberCard(
      orderLabel,
      `
        <div style="margin-top:14px;padding-top:14px;border-top:1px solid ${BRAND.line};">
          <div style="font-size:13px;color:${BRAND.muted};margin-bottom:6px;">Corriere</div>
          <div style="font-size:15px;font-weight:700;color:${BRAND.ink};">${escapeHtml(carrier)}</div>
          <div style="margin-top:12px;font-size:13px;color:${BRAND.muted};margin-bottom:6px;">Codice tracking</div>
          <div style="font-size:16px;font-weight:800;color:${BRAND.fuchsia};">${escapeHtml(trackingNumber)}</div>
        </div>
      `
    )}
  `;

  const html = buildEmailShell({
    subject,
    preheader: `Il tuo ordine ${orderLabel} è in viaggio.`,
    heroHtml: buildHero({
      badge: "Ordine spedito",
      title: "Il tuo pacco è in viaggio",
      subtitle: "Abbiamo affidato il tuo ordine al corriere. Qui sotto trovi tutti i dettagli per seguirne la consegna.",
    }),
    mainHtml: `
      ${trackingCardHtml}
      ${
        trackingUrl
          ? buildButton(trackingUrl, "Segui la spedizione")
          : buildInfoCard(
              "Tracking",
              `Conserva questo codice per seguire la spedizione: <strong>${escapeHtml(trackingNumber)}</strong>`
            )
      }
      ${
        Array.isArray(input.items) && input.items.length
          ? buildItemsTable(input.items, currency)
          : ""
      }
      ${
        typeof input.total === "number"
          ? buildInfoCard(
              "Totale ordine",
              `<strong style="font-size:16px;color:${BRAND.fuchsia};">${escapeHtml(formatMoney(input.total, currency))}</strong>`
            )
          : ""
      }
      ${buildShippingAddressBlock(input.shippingAddress)}
      ${buildInfoCard(
        "Nota utile",
        "Il tracking potrebbe attivarsi entro qualche ora. Se non visualizzi subito gli aggiornamenti, riprova più tardi."
      )}
      ${buildButton(SITE_URL || "#", "Torna al sito")}
    `,
  });

  const text = buildTrackingText(input, subject);
  return sendEmail({ to, subject, html, text });
}