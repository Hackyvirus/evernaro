import type { NextAuthConfig } from "next-auth";

// Edge-safe subset of the full auth config — no providers here. The
// Credentials providers' authorize() pulls in bcrypt + Prisma's query
// engine, which blows past Vercel's Edge Function size limit when
// middleware.ts imports it. src/lib/auth.ts extends this with providers
// for use everywhere else (API routes, server components — all Node.js
// runtime, no size limit like this).
export const authConfig = {
  session: { strategy: "jwt", maxAge: 24 * 60 * 60, updateAge: 60 * 60 },
  pages: { signIn: "/login" },
  providers: [],
  // Trust the host header when AUTH_TRUST_HOST=true (needed for Render and
  // other non-Vercel hosts where Auth.js can't infer the canonical URL).
  trustHost: process.env.AUTH_TRUST_HOST === "true",
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        if (user.isPlatformAdmin) {
          token.isPlatformAdmin = true;
          (token as unknown as Record<string, unknown>).tv = ((user as unknown as { tokenVersion?: number }).tokenVersion ?? 0);
        } else {
          token.orgId = user.orgId;
          token.orgSlug = user.orgSlug;
          token.orgName = user.orgName;
          token.role = user.role;
          token.ev = (user as unknown as { emailVerified?: boolean }).emailVerified;
          (token as unknown as Record<string, unknown>).tv = ((user as unknown as { tokenVersion?: number }).tokenVersion ?? 0);
        }
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) {
        session.user.id = token.sub as string;
        if (token.isPlatformAdmin) {
          session.user.isPlatformAdmin = true;
          (session.user as unknown as Record<string, unknown>).tv = ((token as unknown as Record<string, unknown>).tv as number) ?? 0;
        } else {
          session.user.orgId = token.orgId as string;
          session.user.orgSlug = token.orgSlug as string;
          session.user.orgName = token.orgName as string;
          session.user.role = token.role as string;
          session.user.ev = token.ev as boolean;
          (session.user as unknown as Record<string, unknown>).tv = ((token as unknown as Record<string, unknown>).tv as number) ?? 0;
        }
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
