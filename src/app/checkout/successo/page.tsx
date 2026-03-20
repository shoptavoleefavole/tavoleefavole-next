// src/app/checkout/successo/page.tsx
import SuccessClient from "../success/SuccessClient";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<{ session_id?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const sessionId = String(sp.session_id ?? "").trim();

  return <SuccessClient sessionId={sessionId} />;
}