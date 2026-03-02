// middleware.ts (root del progetto, allo stesso livello di next.config.js)
import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "tf_token";

function buildNextParam(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const raw = `${pathname}${search || ""}`;
  if (raw.length > 600) return "/";
  if (raw.startsWith("/accedi")) return "/";
  return raw || "/";
}

export function middleware(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE)?.value;

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/accedi";
    url.searchParams.set("next", buildNextParam(req));
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// ✅ checkout rimosso: acquisto libero senza login
export const config = {
  matcher: [
    "/account/:path*",
    "/ordini/:path*",
    "/debug/:path*",
  ],
};
