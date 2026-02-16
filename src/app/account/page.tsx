import { redirect } from "next/navigation";
import { requireAuthToken } from "@/lib/auth.server";
import AccountDashboardClient from "./AccountDashboardClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const NEXT_PATH = "/account";

function strapiBaseUrl() {
  const raw =
    process.env.STRAPI_URL ||
    process.env.NEXT_PUBLIC_STRAPI_URL ||
    "http://localhost:1337";
  return raw.replace(/\/+$/, "");
}

type SafeUser = {
  id: number;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  accountType: "PERSON" | "BUSINESS" | null;
};

function safeUserFromMeJson(json: any): SafeUser | null {
  if (!json || typeof json !== "object") return null;

  const id = typeof json.id === "number" ? json.id : null;
  const username = typeof json.username === "string" ? json.username : "";
  const email = typeof json.email === "string" ? json.email : "";

  if (!id || !email) return null;

  const firstName = typeof json.firstName === "string" ? json.firstName : null;
  const lastName = typeof json.lastName === "string" ? json.lastName : null;

  // Se non lo hai ancora in Strapi: resta null (ok).
  const rawType = typeof json.accountType === "string" ? json.accountType.toUpperCase() : null;
  const accountType =
    rawType === "BUSINESS" ? "BUSINESS" : rawType === "PERSON" ? "PERSON" : null;

  return { id, username, email, firstName, lastName, accountType };
}

export default async function AccountPage() {
  // ✅ Richiede token (HttpOnly cookie). Se non loggato → redirect a /accedi?next=/account (dentro la tua funzione)
  let token = "";
  try {
    token = await requireAuthToken(NEXT_PATH);
  } catch {
    // fallback ultra-robusto
    redirect(`/accedi?next=${encodeURIComponent(NEXT_PATH)}`);
  }

  const baseUrl = strapiBaseUrl();

  // ✅ Verifica token su Strapi e ottieni user (server-side)
  const meRes = await fetch(`${baseUrl}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });

  if (!meRes.ok) {
    // token non valido / scaduto → login
    redirect(`/accedi?next=${encodeURIComponent(NEXT_PATH)}&error=1`);
  }

  const meJson = await meRes.json().catch(() => null);
  const user = safeUserFromMeJson(meJson);

  if (!user) {
    // risposta inattesa → forziamo re-auth (non leak, non crash)
    redirect(`/accedi?next=${encodeURIComponent(NEXT_PATH)}&error=1`);
  }

  // ✅ NON passiamo mai token al client
  const whatsappHref = process.env.NEXT_PUBLIC_WHATSAPP_URL || "";

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <AccountDashboardClient user={user} whatsappHref={whatsappHref || undefined} />
    </main>
  );
}
