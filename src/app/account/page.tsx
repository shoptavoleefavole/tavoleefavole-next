import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAuthToken } from "@/lib/auth.server";
import LogoutButton from "@/components/LogoutButton";

type OfferNormalized = {
  id: number | string;
  title: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  onlyForAuthenticated: boolean;
  startAt: string | null;
  endAt: string | null;
  products: Array<{
    id: number | string;
    name: string;
    slug: string;
    price: number;
    compareAtPrice: number | null;
  }>;
};

// ✅ evita caching “strano” su pagina che dipende da cookie
export const dynamic = "force-dynamic";

const NEXT_PATH = "/account";
const LOGIN_FALLBACK = "/accedi?next=/account";

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toNumber(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseDateSafe(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
}

function normalizeOfferRow(row: any): OfferNormalized | null {
  const a = row?.attributes ?? row ?? {};
  const id = row?.id ?? row?.documentId ?? a?.id ?? a?.documentId ?? null;
  if (id == null) return null;

  const title = String(a?.title ?? a?.name ?? "").trim();
  if (!title) return null;

  const discountTypeRaw = String(a?.discountType ?? "PERCENT").toUpperCase();
  const discountType = (discountTypeRaw === "FIXED" ? "FIXED" : "PERCENT") as
    | "PERCENT"
    | "FIXED";

  const discountValue = Math.max(0, toNumber(a?.discountValue, 0));
  const onlyForAuthenticated = Boolean(a?.onlyForAuthenticated);
  const startAt = a?.startAt ? String(a.startAt) : null;
  const endAt = a?.endAt ? String(a.endAt) : null;

  const productsRaw =
    a?.products?.data ??
    a?.products ??
    a?.product?.data ??
    a?.product ??
    [];

  const productsList: any[] = Array.isArray(productsRaw) ? productsRaw : [productsRaw];

  const products = productsList
    .map((p: any) => {
      const pa = p?.attributes ?? p ?? {};
      const pid = p?.id ?? p?.documentId ?? pa?.id ?? pa?.documentId ?? null;
      const slug = String(pa?.slug ?? "").trim();
      const name = String(pa?.name ?? pa?.title ?? "").trim();
      if (!pid || !slug || !name) return null;

      const price = Math.max(0, toNumber(pa?.price, 0));
      const compareAtPrice =
        pa?.compareAtPrice == null ? null : Math.max(0, toNumber(pa?.compareAtPrice, price));

      return { id: pid, name, slug, price, compareAtPrice };
    })
    .filter(Boolean) as OfferNormalized["products"];

  return {
    id,
    title,
    discountType,
    discountValue,
    onlyForAuthenticated,
    startAt,
    endAt,
    products,
  };
}

function isActiveNow(o: OfferNormalized, now: Date) {
  if (o.onlyForAuthenticated !== true) return false;

  const start = parseDateSafe(o.startAt);
  const end = parseDateSafe(o.endAt);
  if (start && now < start) return false;
  if (end && now > end) return false;

  return true;
}

export default async function AccountPage() {
  const token = await requireAuthToken(NEXT_PATH);

  const baseUrl = (process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337").replace(
    /\/+$/,
    ""
  );

  // 1) Utente
  const meRes = await fetch(`${baseUrl}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!meRes.ok) redirect(LOGIN_FALLBACK);

  const me = (await meRes.json()) as { id: number; username?: string; email?: string };

  // 2) Offerte
  let offers: OfferNormalized[] = [];
  try {
    const offersRes = await fetch(`${baseUrl}/api/offers?populate=products`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const text = await offersRes.text().catch(() => "");
    const payload = safeJsonParse(text);

    const rows: any[] = Array.isArray(payload?.data) ? payload.data : [];
    const normalized = rows.map(normalizeOfferRow).filter(Boolean) as OfferNormalized[];

    const now = new Date();
    offers = normalized.filter((o) => isActiveNow(o, now));
  } catch {
    offers = [];
  }

  const username = me?.username ? String(me.username) : "Cliente";
  const email = me?.email ? String(me.email) : "";

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 pb-24 md:pb-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Il tuo account</h1>

          <div className="mt-2 text-sm text-text/70">
            <div className="font-semibold text-text">Ciao, {username} 👋</div>
            {email ? <div>{email}</div> : null}
          </div>
        </div>

        {/* ✅ LOGOUT: qui lo vedi in alto a destra */}
        <div className="shrink-0">
          <LogoutButton />
        </div>
      </div>

      {/* Sezioni account */}
      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Link href="/account/profilo" className="rounded-2xl border border-border bg-background p-4 hover:bg-surface">
          <div className="text-sm font-extrabold">Profilo</div>
          <div className="mt-1 text-xs text-text/60">Dati personali e indirizzi</div>
        </Link>

        <Link href="/account/ordini" className="rounded-2xl border border-border bg-background p-4 hover:bg-surface">
          <div className="text-sm font-extrabold">Ordini</div>
          <div className="mt-1 text-xs text-text/60">Storico e dettagli</div>
        </Link>

        <Link href="/account/preferiti" className="rounded-2xl border border-border bg-background p-4 hover:bg-surface">
          <div className="text-sm font-extrabold">Preferiti</div>
          <div className="mt-1 text-xs text-text/60">Prodotti con il cuore</div>
        </Link>
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-background p-5">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-extrabold">Offerte riservate</h2>
          <div className="text-sm text-text/60">
            Totale: <span className="font-extrabold text-text">{offers.length}</span>
          </div>
        </div>

        {offers.length === 0 ? (
          <div className="mt-4 rounded-xl bg-surface p-4 text-sm text-text/70">
            Nessuna offerta attiva al momento.
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {offers.map((o) => (
              <div key={String(o.id)} className="rounded-2xl border border-border bg-background p-4">
                <div className="text-base font-extrabold">{o.title}</div>

                <div className="mt-2 text-sm">
                  Sconto:{" "}
                  <span className="font-extrabold">
                    {o.discountType === "PERCENT" ? `${o.discountValue}%` : `€ ${o.discountValue.toFixed(2)}`}
                  </span>{" "}
                  <span className="text-text/60">(solo iscritti)</span>
                </div>

                {o.products.length > 0 ? (
                  <div className="mt-3">
                    <div className="text-sm font-semibold text-text/80">Prodotti inclusi:</div>
                    <ul className="mt-2 space-y-2">
                      {o.products.map((p) => (
                        <li key={String(p.id)} className="text-sm">
                          <Link href={`/prodotto/${p.slug}`} className="font-extrabold hover:underline">
                            {p.name}
                          </Link>{" "}
                          <span className="text-text/60">— prezzo listino € {(p.compareAtPrice ?? p.price).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-text/70">Nessun prodotto collegato.</div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-4 text-xs text-text/60">Nota: lo sconto viene applicato solo quando sei loggato.</div>
    </main>
  );
}
