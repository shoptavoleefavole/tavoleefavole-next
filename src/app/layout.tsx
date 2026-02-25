// src/app/layout.tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import Script from "next/script";

import "@/styles/globals.css";

import AppProviders from "@/components/AppProviders";
import Topbar from "@/components/Topbar";
import Header from "@/components/Header";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MobileBottomNav from "@/components/MobileBottomNav";
import Analytics from "@/components/Analytics";
import FavoritesProvider from "@/components/favorites/FavoritesProvider";
import WhatsAppFloatingButton from "@/components/WhatsAppFloatingButton";

function normalizeSiteUrl(input: unknown) {
  const raw = String(input ?? "").trim();

  // dev fallback
  if (!raw) return "http://localhost:3000";

  // se già con protocollo, ok
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, "");

  // se arriva "mydomain.com" o "www...", aggiungo https
  return `https://${raw}`.replace(/\/+$/, "");
}

function computeSite() {
  const rawSiteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const siteUrl = normalizeSiteUrl(rawSiteUrl);

  try {
    return { siteUrl, site: new URL(siteUrl) };
  } catch {
    const fallback = "http://localhost:3000";
    return { siteUrl: fallback, site: new URL(fallback) };
  }
}

const { siteUrl, site } = computeSite();

const defaultTitle = "Tavole & Favole";
const defaultDescription =
  "Ingredienti e accessori per pasticceria, cake design, confetti e specialità dolciarie. Spedizioni, resi e assistenza chiari.";

export const metadata: Metadata = {
  metadataBase: site,
  title: { template: `%s | ${defaultTitle}`, default: defaultTitle },
  description: defaultDescription,

  alternates: {
    canonical: siteUrl,
  },

  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    type: "website",
    url: siteUrl,
    siteName: defaultTitle,
    locale: "it_IT",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: defaultTitle,
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: ["/og.jpg"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className="min-h-dvh bg-background text-text antialiased">
        {/* Skip link accessibilità */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:shadow-md"
        >
          Salta al contenuto
        </a>

        {/* Iubenda: carica lo script UNA SOLA VOLTA */}
        <Script src="https://cdn.iubenda.com/iubenda.js" strategy="afterInteractive" />

        <AppProviders>
          <FavoritesProvider>
            <div className="flex min-h-dvh flex-col">
              <div className="sticky top-0 z-[9999] isolate bg-background shadow-sm">
                <Topbar />

                <Suspense
                  fallback={
                    <div className="border-b border-border">
                      <div className="mx-auto max-w-7xl px-4">
                        <div className="h-[104px] md:h-[88px]" />
                      </div>
                    </div>
                  }
                >
                  <Header />
                </Suspense>

                {/* Desktop categories strip */}
                <div className="hidden border-t border-border bg-background md:block">
                  <div className="mx-auto max-w-7xl px-4">
                    <div className="relative overflow-hidden rounded-2xl">
                      {/* Background texture */}
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-[url('/nav-strip.webp')] bg-cover bg-center"
                      />
                      {/* Overlay per leggibilità */}
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/25 to-background/60"
                      />

                      {/* Contenuto sopra */}
                      <div className="relative">
                        <Navbar />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <main id="main-content" className="flex-1 pb-24 md:pb-0">
                {children}
              </main>

              <Footer />
              <MobileBottomNav />
            </div>

            {/* ✅ Mostra il floating button SOLO su desktop (no doppione su mobile) */}
            <div className="hidden md:block">
              <WhatsAppFloatingButton />
            </div>
          </FavoritesProvider>
        </AppProviders>

        <Analytics />
      </body>
    </html>
  );
}