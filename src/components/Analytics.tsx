"use client";

import Script from "next/script";

/**
 * Google Analytics 4
 *
 * ATTENZIONE:
 * Questo componente è pronto per GA4 ma al momento
 * viene disattivato finché non completiamo il collegamento
 * sicuro con il consenso Iubenda senza dipendenze che rompono la build.
 */
export default function Analytics() {
  const enabled = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true";
  const gaId = process.env.NEXT_PUBLIC_GA4_ID;

  if (!enabled || !gaId) return null;

  return (
    <>
      <Script
        id="ga4-src"
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script
        id="ga4-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('js', new Date());
            gtag('config', '${gaId}', { anonymize_ip: true });
          `,
        }}
      />
    </>
  );
}