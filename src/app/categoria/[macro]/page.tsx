import Link from "next/link";
import { notFound } from "next/navigation";

import { getMacroBySlug, getProductsByMacro } from "@/lib/catalog";
import { getAvailability } from "@/lib/inventory.server";

import ProductsGridWithFilters from "@/components/catalog/ProductsGridWithFilters";
import Breadcrumbs from "@/components/Breadcrumbs";

function safeDecode(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function getDefaultSku(item: any): string | null {
  return item?.variants?.[0]?.sku ?? item?.variant?.sku ?? null;
}

export default async function MacroPage({
  params,
}: {
  params: Promise<{ macro: string }>;
}) {
  const { macro } = await params;
  const macroSlug = safeDecode(macro);
  if (!macroSlug) return notFound();

  const macroObj = await getMacroBySlug(macroSlug);
  if (!macroObj) return notFound();

  const items = await getProductsByMacro(macroSlug);

  const skus = Array.from(
    new Set(
      items
        .map((x: any) => getDefaultSku(x))
        .filter((s: unknown): s is string => typeof s === "string" && s.length > 0)
    )
  );

  const availability = skus.length
    ? await getAvailability({ skus, warehouse: "MAIN" })
    : null;

  const bySku = (availability as any)?.data?.MAIN ?? {};

  const itemsWithStock = items.map((it: any) => {
    const sku = getDefaultSku(it);
    const row = sku ? bySku?.[sku] ?? null : null;
    const available = Number(row?.available ?? 0);

    return {
      ...it,
      inStock: sku ? available > 0 : Boolean(it?.inStock),
      inventory: row,
      sku,
    };
  });

  const hasProducts = itemsWithStock.length > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Catalogo", href: "/catalogo" },
          { label: macroObj.label },
        ]}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">{macroObj.label}</h1>
          <p className="mt-1 text-sm text-text/70">
            Esplora la macroarea e filtra i prodotti{" "}
            {macroObj.subcategories?.length ? "oppure scegli una sottocategoria." : "."}
          </p>
        </div>

        <Link href="/catalogo" className="text-sm font-semibold text-link hover:text-link-hover">
          Torna al catalogo
        </Link>
      </div>

      {macroObj.subcategories?.length > 0 ? (
        <div className="mt-6">
          <h2 className="text-lg font-bold">Sottocategorie</h2>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {macroObj.subcategories.map((sub) => (
              <Link
                key={sub.slug}
                href={`/categoria/${macroObj.slug}/${sub.slug}`}
                className={[
                  "rounded-2xl border border-border bg-background px-4 py-3 hover:bg-surface-2",
                  "flex items-center justify-center text-center",
                  "whitespace-normal break-words leading-tight",
                  "text-sm font-semibold",
                  "min-h-[56px]",
                ].join(" ")}
                title={sub.label}
              >
                {sub.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-8">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-bold">Prodotti</h2>
        </div>

        {!hasProducts ? (
          <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
            <p className="text-sm font-semibold">
              Nessun prodotto disponibile in questa macroarea.
            </p>
            <p className="mt-2 text-sm text-text/70">
              Prova un’altra categoria oppure torna al catalogo completo.
            </p>

            <Link
              href="/catalogo"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-contrast hover:bg-primary-hover"
            >
              Torna al catalogo
            </Link>
          </div>
        ) : (
          <ProductsGridWithFilters
            items={itemsWithStock as any}
            emptyText="Nessun prodotto trovato in questa macroarea."
          />
        )}
      </div>
    </div>
  );
}
