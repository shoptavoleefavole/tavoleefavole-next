"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import Container from "@/components/Container";
import { useCart } from "@/components/cart/CartProvider";

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
      <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" fill="currentColor" />
    </svg>
  );
}

function MenuIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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

function CartIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6h15l-2 9H7L6 6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M6 6L5 3H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 20a1 1 0 100-2 1 1 0 000 2zM18 20a1 1 0 100-2 1 1 0 000 2z" fill="currentColor" />
    </svg>
  );
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function MobileBottomNav() {
  const pathname = usePathname() ?? "/";
  const { summary } = useCart();

  const cartCount = Number(summary?.count ?? 0);

  const items = useMemo(
    () => [
      { href: "/", label: "Home", icon: HomeIcon },
      { href: "/catalogo", label: "Catalogo", icon: GridIcon },
      { href: "/account", label: "Account", icon: UserIcon },
      { href: "/carrello", label: "Carrello", icon: CartIcon, badge: cartCount },
    ],
    [cartCount]
  );

  function openMenu() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("mobile-menu:open"));
    }
  }

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-[9999] border-t border-border bg-background/95 backdrop-blur"
      aria-label="Navigazione principale mobile"
    >
      <Container>
        <div className="grid grid-cols-5 items-center py-2">
          {/* Menu (apre drawer Header) */}
          <button
            type="button"
            onClick={openMenu}
            className="flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs font-extrabold text-muted-text hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Apri menu"
          >
            <MenuIcon />
            MENU
          </button>

          {items.map((it) => {
            const active = isActivePath(pathname, it.href);
            const Icon = it.icon;

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

                {"badge" in it && (it.badge ?? 0) > 0 ? (
                  <span className="absolute right-3 top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-contrast">
                    {it.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </Container>
    </nav>
  );
}
