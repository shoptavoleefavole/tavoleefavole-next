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
  if (!raw) return "http://localhost:3000";
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, "");
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

const defaultTitle       = "Tavole & Favole";
const defaultDescription = "Ingredienti e accessori per pasticceria, cake design, confetti e specialità dolciarie. Spedizioni, resi e assistenza chiari.";

export const metadata: Metadata = {
  metadataBase: site,
  title: { template: `%s | ${defaultTitle}`, default: defaultTitle },
  description: defaultDescription,
  alternates: { canonical: siteUrl },
  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    type: "website",
    url: siteUrl,
    siteName: defaultTitle,
    locale: "it_IT",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: defaultTitle }],
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

        {/* ============================================================
            IUBENDA COOKIE SOLUTION
            Ordine obbligatorio: config → sync → gpp stub → main script
            beforeInteractive: carica prima dell'idratazione React,
            così il banner appare prima che qualsiasi script terze parti
            possa essere eseguito.
        ============================================================ */}

        {/* 1. Configurazione — deve stare PRIMA di tutti gli altri script Iubenda */}
        <Script
          id="iubenda-config"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              var _iub = _iub || [];
              _iub.csConfiguration = {
                "askConsentAtCookiePolicyUpdate": true,
                "countryDetection": true,
                "enableFadp": true,
                "enableLgpd": true,
                "enableUspr": true,
                "floatingPreferencesButtonDisplay": "anchored-center-left",
                "lgpdAppliesGlobally": false,
                "perPurposeConsent": true,
                "siteId": 2088185,
                "storage": { "useSiteId": true },
                "whitelabel": false,
                "cookiePolicyId": 47702140,
                "banner": {
                  "acceptButtonCaptionColor": "#FFFFFF",
                  "acceptButtonColor": "#0073CE",
                  "acceptButtonDisplay": true,
                  "backgroundColor": "#FFFFFF",
                  "closeButtonDisplay": false,
                  "continueWithoutAcceptingButtonCaptionColor": "#4D4D4D",
                  "continueWithoutAcceptingButtonColor": "#DADADA",
                  "customizeButtonCaptionColor": "#4D4D4D",
                  "customizeButtonColor": "#DADADA",
                  "customizeButtonDisplay": true,
                  "explicitWithdrawal": true,
                  "fontSizeBody": "12px",
                  "listPurposes": true,
                  "ownerName": "www.tavoleefavole.com/",
                  "position": "float-bottom-center",
                  "rejectButtonCaptionColor": "#FFFFFF",
                  "rejectButtonColor": "#0073CE",
                  "rejectButtonDisplay": true,
                  "showTitle": false,
                  "showTotalNumberOfProviders": true,
                  "textColor": "#000000"
                }
              };
              _iub.csLangConfiguration = { "it": { "cookiePolicyId": 47702140 } };
            `,
          }}
        />

        {/* 2. Script sync — specifica per il tuo siteId */}
        <Script
          id="iubenda-sync"
          src="//cs.iubenda.com/sync/2088185.js"
          strategy="beforeInteractive"
        />

        {/* 3. GPP stub — necessario per conformità US Privacy / IAB */}
        <Script
          id="iubenda-gpp"
          src="//cdn.iubenda.com/cs/gpp/stub.js"
          strategy="beforeInteractive"
        />

        {/* 4. Script principale Cookie Solution */}
        <Script
          id="iubenda-cs"
          src="//cdn.iubenda.com/cs/iubenda_cs.js"
          strategy="beforeInteractive"
        />

        {/* RIMOSSO: il vecchio <Script src="https://cdn.iubenda.com/iubenda.js"> 
            era lo script dei documenti privacy (widget link), non la Cookie Solution.
            Se nel tuo sito hai link alla privacy policy generati da Iubenda 
            (classe "iubenda-white iubenda-noiframe"), ri-aggiungilo così:
            <Script src="https://cdn.iubenda.com/iubenda.js" strategy="lazyOnload" />
        */}

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
                      <div
                        aria-hidden="true"
                        className="absolute inset-0"
                        style={{
                          background:
                            "linear-gradient(135deg," +
                            "rgba(var(--color-primary-rgb,220,180,120),0.08) 0%," +
                            "rgba(var(--color-primary-rgb,220,180,120),0.03) 50%," +
                            "rgba(var(--color-primary-rgb,220,180,120),0.08) 100%)",
                        }}
                      />
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

            {/* WhatsApp solo desktop */}
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