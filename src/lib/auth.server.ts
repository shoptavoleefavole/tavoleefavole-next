import { cookies } from "next/headers";
import { redirect } from "next/navigation";

function strapiBaseUrl() {
  return (
    process.env.STRAPI_URL ||
    process.env.NEXT_PUBLIC_STRAPI_URL ||
    "http://localhost:1337"
  ).replace(/\/+$/, "");
}

export async function getAuthToken() {
  const store = await cookies(); // ✅ Next 15: cookies() è async
  return store.get("tf_token")?.value ?? null;
}

// ✅ Token obbligatorio, altrimenti redirect a /accedi con next
export async function requireAuthToken(nextPath: string) {
  const token = await getAuthToken();
  if (!token) {
    redirect(`/accedi?next=${encodeURIComponent(nextPath)}`);
  }
  return token;
}

export async function getMe() {
  const token = await getAuthToken();
  if (!token) return null;

  const r = await fetch(`${strapiBaseUrl()}/api/users/me?populate=role`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!r.ok) return null;
  return r.json();
}

export async function requireUser(nextPath: string) {
  const me = await getMe();
  if (!me) {
    redirect(`/accedi?next=${encodeURIComponent(nextPath)}`);
  }
  return me;
}

export async function requireAdmin(nextPath: string) {
  const me = await requireUser(nextPath);

  // Hardening: supporta più forme tipiche di Strapi
  const roleName =
    me?.role?.name ??
    me?.role?.type ??
    me?.role?.data?.attributes?.name ??
    me?.role?.data?.attributes?.type ??
    null;

  if (roleName !== "Admin") {
    redirect(`/`);
  }

  return me;
}
