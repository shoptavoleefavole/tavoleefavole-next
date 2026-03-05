import Link from "next/link";
import Container from "@/components/Container";

const INSTAGRAM_URL = "https://www.instagram.com/tavoleefavole/";
const FACEBOOK_URL  = "https://www.facebook.com/dolciumicarmiano/";

const columns = [
  {
    title: "Azienda",
    links: [
      { label: "Chi siamo", href: "/chi-siamo" },
      { label: "Contatti",  href: "/contatti"  },
    ],
  },
  {
    title: "Assistenza",
    links: [
      // ✅ "Supporto" rimosso
      { label: "Spedizioni",     href: "/spedizioni"    },
      { label: "Resi & rimborsi", href: "/resi-rimborsi" }, // ✅ fix: era /resi
    ],
  },
  {
    title: "Info legali",
    links: [
      { label: "Privacy", href: "/privacy" },        // ✅ fix: era /privacy-policy
      { label: "Cookie",  href: "/cookie"  },        // ✅ fix: era /cookie-policy
      { label: "Termini", href: "/termini" },
    ],
  },
  {
    title: "Social",
    links: [
      { label: "Instagram", href: INSTAGRAM_URL },
      { label: "Facebook",  href: FACEBOOK_URL  },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-border bg-surface-1 text-sm text-muted-text">
      <Container>
        <div className="grid grid-cols-2 gap-8 py-10 md:grid-cols-4">
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="mb-3 text-xs font-extrabold uppercase tracking-widest text-text">
                {col.title}
              </h3>
              <ul className="space-y-2">
                {col.links.map((link) => {
                  const isExternal =
                    link.href.startsWith("http://") ||
                    link.href.startsWith("https://");
                  return (
                    <li key={link.label}>
                      {isExternal ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-text transition-colors"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          className="hover:text-text transition-colors"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border py-6 text-center text-xs text-muted-text">
          © {new Date().getFullYear()} Tavole & Favole. Tutti i diritti riservati.
        </div>
      </Container>
    </footer>
  );
}
