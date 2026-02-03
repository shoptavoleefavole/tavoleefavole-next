import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy",
};

export default function CookiePolicyPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Cookie Policy</h1>

      <div className="mt-6 text-base leading-7">
        <a
          href="https://www.iubenda.com/privacy-policy/47702140/cookie-policy"
          className="iubenda-white no-brand iubenda-noiframe iubenda-embed underline"
          title="Cookie Policy"
        >
          Leggi la Cookie Policy
        </a>
      </div>
    </main>
  );
}
