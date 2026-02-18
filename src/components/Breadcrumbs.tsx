import Link from "next/link";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

function safeLabel(input: unknown, maxLen = 80) {
  const s = String(input ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (!items?.length) return null;

  const safeItems = items
    .map((it) => ({ ...it, label: safeLabel(it.label) }))
    .filter((it) => it.label.length > 0);

  if (!safeItems.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-text/70">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {safeItems.map((it, idx) => {
          const isLast = idx === safeItems.length - 1;
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
