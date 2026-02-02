// middleware.ts (root del progetto, allo stesso livello di next.config.js)
import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "tf_token";

function buildNextParam(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const raw = `${pathname}${search || ""}`;

  // evita next enormi
  if (raw.length > 600) return "/";

  // evita next verso login (anti-loop)
  if (raw.startsWith("/accedi")) return "/";

  return raw || "/";
}

// Rotte che NON devono essere protette (checkout success/cancel incluse)
function isPublicException(pathname: string) {
  return (
    pathname === "/ess" ||
    pathname.startsWith("/ess/") ||
    pathname === "/checkout/success" ||
    pathname.startsWith("/checkout/success/") ||
    pathname === "/checkout/cancel" ||
    pathname.startsWith("/checkout/cancel/")
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ eccezioni pubbliche (importante per evitare loop)
  if (isPublicException(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE)?.value;

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/accedi";
    url.searchParams.set("next", buildNextParam(req));
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// ✅ il middleware gira SOLO sulle rotte protette
export const config = {
  matcher: [
    "/account/:path*",
    "/ordini/:path*",
    "/debug/:path*",
    "/checkout/:path*", // poi escludiamo success/cancel/success nel codice
  ],
};
