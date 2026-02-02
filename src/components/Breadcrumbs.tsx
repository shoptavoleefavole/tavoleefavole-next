import Link from "next/link";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (!items?.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-text/70">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((it, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={`${it.label}-${idx}`} className="flex items-center">
              {idx > 0 ? <span className="mx-2">/</span> : null}
              {it.href && !isLast ? (
                <Link href={it.href} className="hover:underline">
                  {it.label}
                </Link>
              ) : (
                <span className={isLast ? "text-text" : undefined}>{it.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
