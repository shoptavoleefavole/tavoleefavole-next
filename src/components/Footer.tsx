import Link from "next/link";
import Container from "@/components/Container";

const INSTAGRAM_URL = "https://www.instagram.com/tavoleefavole/";
const FACEBOOK_URL = "https://www.facebook.com/dolciumicarmiano/";

const columns = [
  {
    title: "Azienda",
    links: [
      { label: "Chi siamo", href: "/chi-siamo" },
      { label: "Contatti", href: "/contatti" },
    ],
  },
  {
    title: "Assistenza",
    links: [
      { label: "Supporto", href: "/supporto" },
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
    title: "Social",
    links: [
      { label: "Instagram", href: INSTAGRAM_URL },
      { label: "Facebook", href: FACEBOOK_URL },
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
                {col.links.map((l) => {
                  const isExternal = l.href.startsWith("http");
                  return (
                    <li key={l.label}>
                      {isExternal ? (
                        <a
                          href={l.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-muted-text hover:text-link-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          {l.label}
                        </a>
                      ) : (
                        <Link
                          href={l.href}
                          className="text-sm text-muted-text hover:text-link-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          {l.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-border py-6 text-sm text-muted-text sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Tavole & Favole</span>

          <div className="flex flex-wrap items-center gap-4">
            <Link href="/privacy-policy" className="hover:text-link-hover">
              Privacy
            </Link>
            <Link href="/cookie-policy" className="hover:text-link-hover">
              Cookie
            </Link>
            <Link href="/termini" className="hover:text-link-hover">
              Termini
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
