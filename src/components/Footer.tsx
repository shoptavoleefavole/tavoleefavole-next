import Link from "next/link";
import Container from "@/components/Container";

const columns = [
  { title: "Azienda", links: [{ label: "Chi siamo", href: "/supporto" }, { label: "Contatti", href: "/supporto" }, { label: "Lavora con noi", href: "/supporto" }] },
  { title: "Assistenza", links: [{ label: "Supporto", href: "/supporto" }, { label: "Spedizioni", href: "/supporto" }, { label: "Resi & rimborsi", href: "/supporto" }] },
  { title: "Info legali", links: [{ label: "Privacy", href: "/supporto" }, { label: "Cookie", href: "/supporto" }, { label: "Termini", href: "/supporto" }] },
  { title: "Metodi pagamento", links: [{ label: "Carte", href: "/supporto" }, { label: "PayPal", href: "/supporto" }, { label: "Bonifico", href: "/supporto" }] },
];

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-border bg-secondary">
      <Container>
        <div className="grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {columns.map((col) => (
            <div key={col.title}>
              <div className="text-sm font-semibold text-text">{col.title}</div>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-muted-text hover:text-link-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-border py-6 text-sm text-muted-text sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Tavole & Favole (placeholder)</span>
          <div className="flex flex-wrap gap-4">
            <Link href="/supporto" className="hover:text-link-hover">Info legali</Link>
            <Link href="/supporto" className="hover:text-link-hover">Preferenze cookie</Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
