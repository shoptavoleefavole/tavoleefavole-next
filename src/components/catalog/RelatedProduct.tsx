import Link from "next/link";

const STRAPI_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  process.env.STRAPI_URL ||
  "http://localhost:1337";

const STRAPI_TOKEN =
  process.env.STRAPI_API_TOKEN || process.env.NEXT_PUBLIC_STRAPI_API_TOKEN;

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function absUrl(base: string, maybeUrl: string | null | undefined) {
  if (!maybeUrl) return null;
  const u = String(maybeUrl).trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${base.replace(/\/$/, "")}${u}`;
  return u;
}

export default async function RelatedProducts({
  categorySlug,
  excludeSlug,
}: {
  categorySlug: string;
  excludeSlug: string;
}) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (STRAPI_TOKEN) headers.Authorization = `Bearer ${STRAPI_TOKEN}`;

  const qs = new URLSearchParams();
  qs.set("populate", "*");
  qs.set("filters[category][slug][$eq]", categorySlug);
  qs.set("filters[slug][$ne]", excludeSlug);
  qs.set("sort[0]", "createdAt:desc");
  qs.set("pagination[pageSize]", "6");

  const url = `${STRAPI_URL.replace(/\/$/, "")}/api/products?${qs.toString()}`;
  const res = await fetch(url, { next: { revalidate: 60 }, headers });

  if (!res.ok) return null;

  const text = await res.text().catch(() => "");
  const json = safeJsonParse(text);
  const data: any[] = Array.isArray(json?.data) ? json.data : [];

  const items = data.map((p: any) => {
    const slug = p?.slug ?? p?.attributes?.slug ?? "";
    const name = p?.name ?? p?.attributes?.name ?? "";

    const images =
      p?.images ??
      p?.attributes?.images?.data ??
      p?.attributes?.images ??
      [];

    const first = Array.isArray(images) ? images[0] : images;
    const imageUrlRaw =
      first?.formats?.small?.url ??
      first?.formats?.thumbnail?.url ??
      first?.url ??
      first?.attributes?.url ??
      null;

    const imageUrl = absUrl(STRAPI_URL, imageUrlRaw);
    const price = p?.price ?? p?.attributes?.price ?? null;

    return { slug: String(slug), name: String(name), imageUrl, price };
  }).filter((x: any) => x.slug);

  if (!items.length) return null;

  return (
    <section className="mt-10">
      <h2 className="text-lg font-extrabold">Ti potrebbe interessare</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p: any) => (
          <Link
            key={p.slug}
            href={`/prodotto/${p.slug}`}
            className="rounded-2xl border border-border bg-background p-4 hover:bg-surface-2"
          >
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt={p.name} className="h-40 w-full rounded-xl object-cover" />
            ) : (
              <div className="h-40 w-full rounded-xl bg-black/5" />
            )}
            <div className="mt-3 text-sm font-extrabold line-clamp-2">{p.name}</div>
            <div className="mt-1 text-sm text-text/70">
              {typeof p.price === "number" ? `€ ${p.price.toFixed(2)}` : "—"}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
