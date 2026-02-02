import OrderDetailPageClient from "@/components/account/OrderDetailPageClient";

export const dynamic = "force-dynamic";

function safeDecode(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export default async function Page({
  params,
}: {
  params?: Promise<{ id: string }>;
}) {
  const p = (await params) ?? ({} as any);
  const documentId = safeDecode(p?.id);
  return <OrderDetailPageClient documentId={documentId} />;
}
