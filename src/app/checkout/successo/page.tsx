import SuccessClient from "../success/SuccessClient";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

type VerifyResponse = {
  ok: boolean;
  paid?: boolean;
  updated?: boolean;
  orderRef?: string | null;
  orderId?: number | null;
  message?: string;
  error?: string;
  details?: any;
  payment_status?: string;
  status?: string;
};

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<{ session_id?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const sessionId = String(sp.session_id ?? "").trim();

  let initialInfo: VerifyResponse | null = null;

  if (sessionId) {
    try {
      const h = await headers();
      const proto =
        h.get("x-forwarded-proto") ||
        (process.env.NODE_ENV === "production" ? "https" : "http");
      const host = h.get("x-forwarded-host") || h.get("host");

      if (host) {
        const origin = `${proto}://${host}`;
        const res = await fetch(
          `${origin}/api/checkout/verify?session_id=${encodeURIComponent(sessionId)}`,
          { cache: "no-store" }
        );

        if (res.ok) {
          initialInfo = (await res.json()) as VerifyResponse;
        }
      }
    } catch {
      initialInfo = null;
    }
  }

  return <SuccessClient sessionId={sessionId} initialInfo={initialInfo} />;
}