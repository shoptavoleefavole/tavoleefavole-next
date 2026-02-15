import { redirect } from "next/navigation";
import { requireAuthToken } from "@/lib/auth.server";

// ✅ evita caching “strano” su pagina che dipende da cookie
export const dynamic = "force-dynamic";

const NEXT_PATH = "/account";
const HOME_PATH = "/";
const LOGIN_FALLBACK = "/accedi?next=/";

export default async function AccountPage() {
  // Se non sei loggato, la tua requireAuthToken probabilmente fa già redirect.
  // In ogni caso, teniamo anche un fallback robusto dopo la chiamata /users/me.
  const token = await requireAuthToken(NEXT_PATH);

  const baseUrl = (
    process.env.STRAPI_URL ||
    process.env.NEXT_PUBLIC_STRAPI_URL ||
    "http://localhost:1337"
  ).replace(/\/+$/, "");

  // Verifica token su Strapi
  const meRes = await fetch(`${baseUrl}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  // Non autorizzato -> login
  if (!meRes.ok) redirect(LOGIN_FALLBACK);

  // Autorizzato -> Home
  redirect(HOME_PATH);
}
