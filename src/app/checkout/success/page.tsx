// src/app/checkout/success/page.tsx
import SuccessClient from "./SuccessClient";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<{ session_id?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const sessionId = String(sp.session_id ?? "").trim();

  // UI e logica stanno tutte nel client component
  return <SuccessClient sessionId={sessionId} />;
}