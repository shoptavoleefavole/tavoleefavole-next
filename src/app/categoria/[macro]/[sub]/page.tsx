import Link from "next/link";
import { notFound } from "next/navigation";

import { getMacroBySlug, getSubBySlug, getProductsByMacroAndSub } from "@/lib/catalog";
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

export default async function MacroSubPage({
  params,
}: {
  params: Promise<{ macro: string; sub: string }>;
}) {
  const { macro, sub } = await params;

  const macroSlug = safeDecode(macro);
  const subSlug = safeDecode(sub);

  if (!macroSlug || !subSlug) return notFound();

  const macroObj = await getMacroBySlug(macroSlug);
  if (!macroObj) return notFound();

  const subObj = await getSubBySlug(macroSlug, subSlug);
  if (!subObj) return notFound();

  const items = await getProductsByMacroAndSub(macroSlug, subSlug);

  const skus = Array.from(
    new Set(
      items
        .map((it: any) => getDefaultSku(it))
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
          { label: macroObj.label, href: `/categoria/${macroObj.slug}` },
          { label: subObj.label },
        ]}
      />

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">
            {macroObj.label} · {subObj.label}
          </h1>
          <p className="mt-1 text-sm text-text/70">
            Filtra e ordina i prodotti della sottocategoria.
          </p>
        </div>

        <Link href="/catalogo" className="text-sm font-semibold text-link hover:text-link-hover">
          Torna al catalogo
        </Link>
      </div>

      {!hasProducts ? (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm font-semibold">
            Nessun prodotto disponibile in questa sottocategoria.
          </p>
          <p className="mt-2 text-sm text-text/70">
            Prova un’altra sottocategoria oppure torna al catalogo completo.
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
          emptyText="Nessun prodotto trovato in questa sottocategoria."
        />
      )}
    </div>
  );
}