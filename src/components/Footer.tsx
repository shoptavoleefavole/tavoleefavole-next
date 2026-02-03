import Link from "next/link";
import Container from "@/components/Container";

const columns = [
  {
    title: "Azienda",
    links: [
      { label: "Chi siamo", href: "/chi-siamo" },
      { label: "Contatti", href: "/contatti" },
      { label: "Lavora con noi", href: "/supporto" }, // placeholder
    ],
  },
  {
    title: "Assistenza",
    links: [
      { label: "Supporto", href: "/supporto" }, // se esiste già
      { label: "Spedizioni", href: "/spedizioni" },
      { label: "Resi & rimborsi", href: "/resi" },
    ],
  },
  {
    title: "Info legali",
    links: [
      { label: "Privacy", href: "/privacy-policy" },
      { label: "Cookie", href: "/cookie-policy" },
      { label: "Termini", href: "/termini" },
    ],
  },
  {
    title: "Metodi pagamento",
    links: [
      { label: "Carte", href: "/supporto" }, // placeholder
      { label: "PayPal", href: "/supporto" }, // placeholder
      { label: "Bonifico", href: "/supporto" }, // placeholder
    ],
  },
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
                    <Link
                      href={l.href}
                      className="text-sm text-muted-text hover:text-link-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-border py-6 text-sm text-muted-text sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Tavole & Favole</span>

          <div className="flex flex-wrap gap-4">
            <Link href="/privacy-policy" className="hover:text-link-hover">
              Privacy
            </Link>
            <Link href="/cookie-policy" className="hover:text-link-hover">
              Cookie
            </Link>
            <Link href="/termini" className="hover:text-link-hover">
              Termini
            </Link>

            {/* “Preferenze cookie” (placeholder sicuro): porta alla Cookie Policy.
               Se hai Iubenda CMP attiva, lo trasformiamo nel vero link "apri preferenze". */}
            <Link href="/cookie-policy" className="hover:text-link-hover">
              Preferenze cookie
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
