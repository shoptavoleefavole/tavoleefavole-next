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

function normalizeSiteUrl(input: string) {
  // Se l'utente inserisce "www.sito.it" senza protocollo, aggiungiamo https://
  if (input.startsWith("http://") || input.startsWith("https://")) return input;
  return `https://${input}`;
}

const rawSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

const siteUrl = normalizeSiteUrl(rawSiteUrl);
const site = new URL(siteUrl);

const defaultTitle = "Tavole & Favole";
const defaultDescription = "E-commerce scaffold in Next.js + TypeScript (mock)";

export const metadata: Metadata = {
  metadataBase: site,

  title: { template: `%s | ${defaultTitle}`, default: defaultTitle },
  description: defaultDescription,

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
    <html lang="it">
      <body className="min-h-dvh bg-background text-text antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:shadow-md"
        >
          Salta al contenuto
        </a>

        {/* ✅ Iubenda: carica lo script UNA SOLA VOLTA (Privacy/Cookie links funzionano ovunque) */}
        <Script
          src="https://cdn.iubenda.com/iubenda.js"
          strategy="afterInteractive"
        />

        <AppProviders>
          {/* ✅ Provider preferiti globale: header + pagine + mobile nav */}
          <FavoritesProvider>
            <div className="flex min-h-dvh flex-col">
              {/* HEADER STICKY (Topbar + Header + Navbar desktop) */}
              <div className="sticky top-0 z-[9999] isolate bg-background shadow-sm">
                <Topbar />

                {/* Header è client (usaSearchParams) -> Suspense per evitare bailout */}
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

                {/* ✅ Navbar SOLO desktop (evita doppio "Menu" su mobile) */}
                <div className="hidden md:block border-t border-border bg-background">
                  <div className="mx-auto max-w-7xl px-4">
                    <Navbar />
                  </div>
                </div>
              </div>

              <main id="main-content" className="flex-1 pb-24 md:pb-0">
                {children}
              </main>

              <Footer />

              {/* Mobile bottom nav */}
              <MobileBottomNav />
            </div>
          </FavoritesProvider>
        </AppProviders>

        {/* ✅ Analytics placeholder (carica solo se env abilitate) */}
        <Analytics />
      </body>
    </html>
  );
}
