import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const CLIENT_PROTECTED_PREFIXES = ["/inbox", "/settings", "/contacts", "/campaigns", "/reminders"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isPlatformAdmin = !!req.auth?.user?.isPlatformAdmin;

  // Platform admin area — a completely separate auth track from org users.
  if (pathname.startsWith("/platform")) {
    const isPlatformAuthPage =
      pathname.startsWith("/platform/login") || pathname.startsWith("/platform/setup");

    if (isPlatformAuthPage) {
      if (isPlatformAdmin) return NextResponse.redirect(new URL("/platform", req.nextUrl));
      return NextResponse.next();
    }
    if (!isPlatformAdmin) {
      return NextResponse.redirect(new URL("/platform/login", req.nextUrl));
    }
    return NextResponse.next();
  }

  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/signup");
  if (isAuthPage) {
    if (isLoggedIn && !isPlatformAdmin) {
      return NextResponse.redirect(new URL("/inbox", req.nextUrl));
    }
    return NextResponse.next();
  }

  const isProtected = CLIENT_PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isProtected && (!isLoggedIn || isPlatformAdmin)) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/inbox/:path*",
    "/settings/:path*",
    "/contacts/:path*",
    "/campaigns/:path*",
    "/reminders/:path*",
    "/login",
    "/signup",
    "/platform/:path*",
  ],
};
