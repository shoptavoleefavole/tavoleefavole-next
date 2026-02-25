"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Container from "@/components/Container";

function HomeIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GridIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z"
        fill="currentColor"
      />
    </svg>
  );
}

function UserIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 21a8 8 0 10-16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 13a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function WhatsAppIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 11.9a8 8 0 0 1-11.8 7L4 20l1.2-4.1A8 8 0 1 1 20 11.9Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 8.9c.2-.4.4-.4.6-.4h.5c.2 0 .4 0 .5.3l.7 1.6c.1.3.1.6-.1.8l-.4.5c.6 1 1.5 1.9 2.6 2.5l.5-.4c.2-.2.5-.2.8-.1l1.6.7c.3.1.3.3.3.5v.5c0 .2 0 .4-.4.6-.5.3-1.5.5-2.7 0-2.2-.8-4.6-3-5.5-5.2-.5-1.2-.3-2.2 0-2.7Z"
        fill="currentColor"
      />
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
  const whatsappHref = process.env.NEXT_PUBLIC_WHATSAPP_URL || "https://wa.me/393482783901";

  const items: NavItem[] = [
    { href: whatsappHref, label: "WhatsApp", icon: WhatsAppIcon, external: true },
    { href: "/", label: "Home", icon: HomeIcon },
    { href: "/catalogo", label: "Catalogo", icon: GridIcon },
    { href: "/account", label: "Account", icon: UserIcon },
  ];

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-[9999] border-t border-border bg-background/95 backdrop-blur"
      aria-label="Navigazione principale mobile"
    >
      <Container>
        <div className="grid grid-cols-4 items-center py-2">
          {items.map((it) => {
            const active = !it.external ? isActivePath(pathname, it.href) : false;
            const Icon = it.icon;

            if (it.external) {
              return (
                <a
                  key={it.href}
                  href={it.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs font-extrabold text-muted-text hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label="Apri WhatsApp"
                >
                  <Icon />
                  {it.label}
                </a>
              );
            }

            return (
              <Link
                key={it.href}
                href={it.href}
                className={`relative flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs font-extrabold hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  active ? "text-text" : "text-muted-text"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon />
                {it.label}
              </Link>
            );
          })}
        </div>
      </Container>
    </nav>
  );
}