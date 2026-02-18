import { redirect } from "next/navigation";
import { requireAuthToken } from "@/lib/auth.server";
import AccountDashboardClient from "./AccountDashboardClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const NEXT_PATH = "/account";

function strapiBaseUrl() {
  const raw = process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";
  return raw.replace(/\/+$/, "");
}

type SafeUser = {
  id: number;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  // manteniamo i tuoi valori
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

  const rawType = typeof json.accountType === "string" ? json.accountType.toUpperCase() : null;
  const accountType = rawType === "BUSINESS" ? "BUSINESS" : rawType === "PERSON" ? "PERSON" : null;

  return { id, username, email, firstName, lastName, accountType };
}

type ProfileApiResponse = {
  ok: boolean;
  firstName?: string | null;
  lastName?: string | null;
  customerType?: "PRIVATE" | "BUSINESS" | string;
};

function nonEmpty(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

export default async function AccountPage() {
  // ✅ Richiede token (HttpOnly cookie). Se non loggato → redirect a /accedi?next=/account
  let token = "";
  try {
    token = await requireAuthToken(NEXT_PATH);
  } catch {
    redirect(`/accedi?next=${encodeURIComponent(NEXT_PATH)}`);
  }

  const baseUrl = strapiBaseUrl();

  // ✅ /users/me su Strapi (server-side)
  const meRes = await fetch(`${baseUrl}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });

  if (!meRes.ok) {
    redirect(`/accedi?next=${encodeURIComponent(NEXT_PATH)}&error=1`);
  }

  const meJson = await meRes.json().catch(() => null);
  const userBase = safeUserFromMeJson(meJson);

  if (!userBase) {
    redirect(`/accedi?next=${encodeURIComponent(NEXT_PATH)}&error=1`);
  }

  // ✅ Arricchimento: leggi firstName/lastName dal profilo (customer-profile)
  // Nota: questa chiamata passa dentro il Next server, quindi include i cookie automaticamente.
  let profile: ProfileApiResponse | null = null;
  try {
    const profileRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/account/profile`, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    // Se NEXT_PUBLIC_SITE_URL non è impostata, fetch relativo potrebbe fallire in alcuni ambienti.
    // Fallback: prova relativo.
    if (!profileRes.ok) {
      const fallbackRes = await fetch(`/api/account/profile`, {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      profile = (await fallbackRes.json().catch(() => null)) as ProfileApiResponse | null;
    } else {
      profile = (await profileRes.json().catch(() => null)) as ProfileApiResponse | null;
    }
  } catch {
    profile = null;
  }

  const profileFirst = profile?.ok ? nonEmpty(profile.firstName) : null;
  const profileLast = profile?.ok ? nonEmpty(profile.lastName) : null;

  // customerType PRIVATE/BUSINESS → lo mappiamo su accountType PERSON/BUSINESS (opzionale)
  const profileTypeRaw = profile?.ok ? String(profile.customerType ?? "").toUpperCase() : "";
  const profileAccountType: SafeUser["accountType"] =
    profileTypeRaw === "BUSINESS" ? "BUSINESS" : profileTypeRaw ? "PERSON" : null;

  const user: SafeUser = {
    ...userBase,
    // ✅ se su users/me sono vuoti, prendiamo dal profilo
    firstName: userBase.firstName?.trim() ? userBase.firstName : profileFirst,
    lastName: userBase.lastName?.trim() ? userBase.lastName : profileLast,
    // ✅ se non presente su /me, mettiamo il type dal profilo
    accountType: userBase.accountType ?? profileAccountType,
  };

  const whatsappHref = process.env.NEXT_PUBLIC_WHATSAPP_URL || "";

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <AccountDashboardClient user={user} whatsappHref={whatsappHref || undefined} />
    </main>
  );
}
