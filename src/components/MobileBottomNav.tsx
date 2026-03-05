"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Container from "@/components/Container";

function HomeIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function GridIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function UserIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function WhatsAppIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.855L.057 23.57a.75.75 0 0 0 .922.899l5.919-1.55A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.694-.5-5.243-1.375l-.372-.213-3.862 1.012 1.029-3.757-.23-.386A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
    </svg>
  );
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type NavItem =
  | { href: string; label: string; icon: React.ComponentType<{ className?: string }>; external?: false }
  | { href: string; label: string; icon: React.ComponentType<{ className?: string }>; external: true };

export default function MobileBottomNav() {
  const pathname = usePathname() ?? "/";

  // ✅ usa env se presente, altrimenti fallback numero
  const whatsappHref =
    process.env.NEXT_PUBLIC_WHATSAPP_URL || "https://wa.me/393482783901";

  const items: NavItem[] = [
    { href: whatsappHref, label: "WhatsApp", icon: WhatsAppIcon, external: true },
    { href: "/",         label: "Home",      icon: HomeIcon                      },
    { href: "/catalogo", label: "Catalogo",  icon: GridIcon                      },
    { href: "/account",  label: "Account",   icon: UserIcon                      },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background md:hidden"
      aria-label="Navigazione mobile"
    >
      <Container>
        <div className="flex items-center justify-around py-2">
          {items.map((it) => {
            const active = !it.external ? isActivePath(pathname, it.href) : false;
            const Icon   = it.icon;

            if (it.external) {
              return (
                <a
                  key={it.label}
                  href={it.href}
                  target="_blank"
                  rel="noopener noreferrer"   // ✅ fix sicurezza: previene tabnapping
                  className="flex flex-col items-center gap-0.5 px-3 py-1 text-muted-text hover:text-text transition-colors"
                  aria-label={it.label}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-[10px] font-semibold">{it.label}</span>
                </a>
              );
            }

            return (
              <Link
                key={it.label}
                href={it.href}
                className={[
                  "flex flex-col items-center gap-0.5 px-3 py-1 transition-colors",
                  active ? "text-primary" : "text-muted-text hover:text-text",
                ].join(" ")}
                aria-label={it.label}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-6 w-6" />
                <span className="text-[10px] font-semibold">{it.label}</span>
              </Link>
            );
          })}
        </div>
      </Container>
    </nav>
  );
}
