"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SafeUser = {
  id: number;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  accountType: "PERSON" | "BUSINESS" | null;
};

type ProfilePayload = {
  ok: boolean;
  firstName?: string | null;
  lastName?: string | null;
  customerType?: "PRIVATE" | "BUSINESS";
};

const AUTH_EVENT = "tf:auth-changed";

function sanitizeInlineText(input: unknown, maxLen = 40): string {
  const raw = String(input ?? "");
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen)}…` : cleaned;
}

function niceFallbackName(u: SafeUser) {
  const fn = sanitizeInlineText(u.firstName);
  const ln = sanitizeInlineText(u.lastName);
  const full = `${fn} ${ln}`.trim();
  return full || sanitizeInlineText(u.username) || "Account";
}

function CardIcon({ name }: { name: "user" | "box" | "heart" | "file" | "help" }) {
  switch (name) {
    case "user":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M20 21a8 8 0 10-16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 13a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "box":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M21 8l-9 5-9-5 9-5 9 5zM3 8v8l9 5 9-5V8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "heart":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 21s-7-4.5-9.5-8.5C.5 9 2.5 6 6 6c2 0 3.5 1.2 4 2 0.5-.8 2-2 4-2 3.5 0 5.5 3 3.5 6.5C19 16.5 12 21 12 21z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "file":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M14 2H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V8l-5-6z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    case "help":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 18h.01M9.5 9a2.5 2.5 0 115 0c0 2-2.5 2-2.5 4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path d="M12 22a10 10 0 100-20 10 10 0 000 20z" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    default:
      return null;
  }
}

function DashboardCard(props: {
  title: string;
  desc: string;
  href?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  badge?: string;
}) {
  const inner = (
    <div className="rounded-2xl border border-border bg-background p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface text-text">{props.icon}</div>
          <div>
            <div className="text-sm font-extrabold">{props.title}</div>
            <div className="mt-1 text-sm text-text/70">{props.desc}</div>
          </div>
        </div>

        {props.badge ? (
          <div className="rounded-full bg-surface px-2 py-1 text-[11px] font-bold text-text/70">{props.badge}</div>
        ) : null}
      </div>
    </div>
  );

  if (props.href) {
    return (
      <Link
        href={props.href}
        className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={props.onClick}
      className="w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {inner}
    </button>
  );
}

function formatName(firstName: unknown, lastName: unknown) {
  const fn = sanitizeInlineText(firstName);
  const ln = sanitizeInlineText(lastName);
  return `${fn} ${ln}`.trim();
}

export default function AccountDashboardClient({
  user,
  whatsappHref,
}: {
  user: SafeUser;
  whatsappHref?: string;
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  // ✅ Nome “reale” dal customer-profile
  const [profileName, setProfileName] = useState<string>("");

  const isBusiness = user.accountType === "BUSINESS";

  const display = useMemo(() => {
    // priorità: nome dal profilo -> fallback server user
    return profileName || niceFallbackName(user);
  }, [profileName, user]);

  const loadProfileName = useCallback(async () => {
    try {
      const res = await fetch("/api/account/profile", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return;

      const data = (await res.json().catch(() => null)) as ProfilePayload | null;
      if (!data?.ok) return;

      const full = formatName(data.firstName, data.lastName);
      setProfileName(full);
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    loadProfileName();

    const onAuth = () => {
      loadProfileName();
    };
    window.addEventListener(AUTH_EVENT, onAuth);
    return () => window.removeEventListener(AUTH_EVENT, onAuth);
  }, [loadProfileName]);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
    } catch {
      // best-effort
    } finally {
      window.dispatchEvent(new Event(AUTH_EVENT));
      setLoggingOut(false);
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <section className="mx-auto max-w-5xl">
      <div className="rounded-3xl border border-border bg-background p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold">
              Ciao, <span className="text-primary">{display}</span>
            </h1>
            <p className="mt-2 text-sm text-text/70">Da qui puoi gestire ordini, profilo e preferiti in modo semplice e veloce.</p>
            <p className="mt-1 text-xs text-text/60">
              Email: <span className="font-semibold">{sanitizeInlineText(user.email, 80)}</span>
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/catalogo"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-white px-4 text-sm font-extrabold hover:bg-surface"
            >
              Continua lo shopping
            </Link>

            <button
              type="button"
              onClick={logout}
              disabled={loggingOut}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-extrabold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {loggingOut ? "Uscita…" : "Logout"}
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DashboardCard title="Profilo" desc="Dati personali, sicurezza e preferenze." href="/account/profilo" icon={<CardIcon name="user" />} />
          <DashboardCard title="Ordini" desc="Storico ordini e dettagli delle spedizioni." href="/account/ordini" icon={<CardIcon name="box" />} />
          <DashboardCard title="Preferiti" desc="I prodotti salvati per acquisti futuri." href="/account/preferiti" icon={<CardIcon name="heart" />} />
          <DashboardCard
            title="Fatturazione"
            desc="Indirizzi, PEC/SDI e dati di fatturazione."
            href={isBusiness ? "/account/fatturazione" : "/account/indirizzi"}
            badge={isBusiness ? "Business" : "Privato"}
            icon={<CardIcon name="file" />}
          />

          {whatsappHref ? (
            <DashboardCard title="Assistenza rapida" desc="Scrivici su WhatsApp: ti aiutiamo subito." href={whatsappHref} icon={<CardIcon name="help" />} badge="WhatsApp" />
          ) : (
            <DashboardCard title="Assistenza" desc="Contattaci per supporto su ordini e prodotti." href="/contatti" icon={<CardIcon name="help" />} />
          )}
        </div>

        <div className="mt-6 text-xs text-text/60">
          Suggerimento: per una gestione completa e ordinata, questa area evita menu a tendina sovrapposti e mantiene l’esperienza pulita su mobile e desktop.
        </div>
      </div>
    </section>
  );
}
