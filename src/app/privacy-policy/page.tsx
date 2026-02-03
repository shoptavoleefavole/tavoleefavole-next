import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Privacy Policy</h1>

      <div className="mt-6 text-base leading-7">
        <a
          href="https://www.iubenda.com/privacy-policy/47702140"
          className="iubenda-white no-brand iubenda-noiframe iubenda-embed underline"
          title="Privacy Policy"
        >
          Leggi la Privacy Policy
        </a>
      </div>
    </main>
  );
}
