import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "oki_auth_session";
const AUTH_COOKIE_VALUE = "supabase";

export function proxy(request: NextRequest) {
  const hasSessionCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value === AUTH_COOKIE_VALUE;

  if (!hasSessionCookie) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
