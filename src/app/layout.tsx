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

function normalizeSiteUrl(input: string) {
  const s = String(input || "").trim();
  if (!s) return "http://localhost:3000";
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

const rawSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

let siteUrl = normalizeSiteUrl(rawSiteUrl);
let site: URL;

try {
  siteUrl = siteUrl.replace(/\/+$/, "");
  site = new URL(siteUrl);
} catch {
  siteUrl = "http://localhost:3000";
  site = new URL(siteUrl);
}

const defaultTitle = "Tavole & Favole";
const defaultDescription =
  "Ingredienti e accessori per pasticceria, cake design, confetti e specialità dolciarie. Spedizioni, resi e assistenza chiari.";

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

                <div className="hidden border-t border-border bg-background md:block">
                  <div className="mx-auto max-w-7xl px-4">
                    <Navbar />
                  </div>
                </div>
              </div>

              <main id="main-content" className="flex-1 pb-24 md:pb-0">
                {children}
              </main>

              <Footer />
              <MobileBottomNav />
            </div>

            <WhatsAppFloatingButton />
          </FavoritesProvider>
        </AppProviders>

        <Analytics />
      </body>
    </html>
  );
}
