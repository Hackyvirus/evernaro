import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

// Edge runtime: build auth() from the provider-less config only, so
// bcrypt/Prisma (pulled in by the real providers in src/lib/auth.ts) never
// get bundled into this Edge Function.
const { auth } = NextAuth(authConfig);

const CLIENT_PROTECTED_PREFIXES = [
  "/dashboard",
  "/inbox",
  "/settings",
  "/contacts",
  "/campaigns",
  "/reminders",
  "/analytics",
  "/channels",
  "/knowledge",
  "/team",
  "/billing",
];

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isPlatformAdmin = !!req.auth?.user?.isPlatformAdmin;

  // Platform admin area — a completely separate auth track from org users.
  if (pathname.startsWith("/platform")) {
    const isPlatformAuthPage =
      pathname.startsWith("/platform/login") ||
      pathname.startsWith("/platform/setup") ||
      pathname.startsWith("/platform/forgot-password") ||
      pathname.startsWith("/platform/reset-password");

    if (isPlatformAuthPage) {
      if (isPlatformAdmin) return NextResponse.redirect(new URL("/platform", req.nextUrl));
      return NextResponse.next();
    }
    if (!isPlatformAdmin) {
      return NextResponse.redirect(new URL("/platform/login", req.nextUrl));
    }
    return NextResponse.next();
  }

  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/signup") || pathname.startsWith("/forgot-password") || pathname.startsWith("/reset-password") || pathname.startsWith("/verify-email");
  if (isAuthPage) {
    if (isLoggedIn && !isPlatformAdmin) {
      return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
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
    "/dashboard/:path*",
    "/inbox/:path*",
    "/settings/:path*",
    "/contacts/:path*",
    "/campaigns/:path*",
    "/reminders/:path*",
    "/analytics/:path*",
    "/channels/:path*",
    "/knowledge/:path*",
    "/team/:path*",
    "/billing/:path*",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/platform/:path*",
  ],
};
