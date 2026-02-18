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

const STRAPI_SERVICE_TOKEN =
  process.env.STRAPI_API_TOKEN ||
  process.env.STRAPI_TOKEN ||
  process.env.NEXT_PUBLIC_STRAPI_API_TOKEN ||
  process.env.NEXT_PUBLIC_STRAPI_TOKEN ||
  "";

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

  const rawType = typeof json.accountType === "string" ? json.accountType.toUpperCase() : null;
  const accountType = rawType === "BUSINESS" ? "BUSINESS" : rawType === "PERSON" ? "PERSON" : null;

  return { id, username, email, firstName, lastName, accountType };
}

function extractAttrs(row: any) {
  if (!row || typeof row !== "object") return {};
  if (row.attributes && typeof row.attributes === "object") return row.attributes;
  const out: any = { ...row };
  delete out.id;
  delete out.documentId;
  return out;
}

async function fetchCustomerProfileName(baseUrl: string, userId: number): Promise<{ firstName?: string; lastName?: string } | null> {
  if (!STRAPI_SERVICE_TOKEN) return null;

  const qs = new URLSearchParams();
  qs.set("pagination[pageSize]", "1");
  qs.set("filters[user][id][$eq]", String(userId));

  const res = await fetch(`${baseUrl}/api/customer-profiles?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${STRAPI_SERVICE_TOKEN}`, Accept: "application/json" },
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  const row = Array.isArray(json?.data) ? json.data[0] : null;
  if (!row) return null;

  const attrs = extractAttrs(row);
  const firstName = typeof attrs.firstName === "string" ? attrs.firstName : "";
  const lastName = typeof attrs.lastName === "string" ? attrs.lastName : "";

  if (!firstName && !lastName) return null;
  return { firstName, lastName };
}

export default async function AccountPage() {
  let token = "";
  try {
    token = await requireAuthToken(NEXT_PATH);
  } catch {
    redirect(`/accedi?next=${encodeURIComponent(NEXT_PATH)}`);
  }

  const baseUrl = strapiBaseUrl();

  const meRes = await fetch(`${baseUrl}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });

  if (!meRes.ok) {
    redirect(`/accedi?next=${encodeURIComponent(NEXT_PATH)}&error=1`);
  }

  const meJson = await meRes.json().catch(() => null);
  const user = safeUserFromMeJson(meJson);

  if (!user) {
    redirect(`/accedi?next=${encodeURIComponent(NEXT_PATH)}&error=1`);
  }

  // ✅ prende nome/cognome dal customer-profile (se presente)
  const profileName = await fetchCustomerProfileName(baseUrl, user.id);
  const mergedUser: SafeUser = {
    ...user,
    firstName: profileName?.firstName?.trim() ? profileName.firstName : user.firstName,
    lastName: profileName?.lastName?.trim() ? profileName.lastName : user.lastName,
  };

  const whatsappHref = process.env.NEXT_PUBLIC_WHATSAPP_URL || "";

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <AccountDashboardClient user={mergedUser} whatsappHref={whatsappHref || undefined} />
    </main>
  );
}
