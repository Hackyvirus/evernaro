import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// A valid-format bcrypt hash of a value nobody will ever type, used to keep
// authorize()'s timing constant whether or not the email is registered —
// otherwise "no such user" (fast, no hashing) is distinguishable from "wrong
// password" (slower, hashes) purely by response latency, enabling email
// enumeration.
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO0j0FEEC0MEsAcaZ1EOwLmR2ILzTkoOK";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: { org: true },
        });

        const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          orgId: user.orgId,
          orgSlug: user.org.slug,
          orgName: user.org.name,
          role: user.role,
        };
      },
    }),
    // Entirely separate credential space from org Users — platform admins
    // (Eversity Tech LLP staff) can see across every client org, so they
    // must never be confused with an org-scoped login.
    Credentials({
      id: "platform-admin",
      name: "Platform Admin",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const admin = await prisma.platformAdmin.findUnique({
          where: { email: email.toLowerCase() },
        });

        const valid = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);
        if (!admin || !valid) return null;

        return {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          isPlatformAdmin: true,
        };
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        if (user.isPlatformAdmin) {
          token.isPlatformAdmin = true;
        } else {
          token.orgId = user.orgId;
          token.orgSlug = user.orgSlug;
          token.orgName = user.orgName;
          token.role = user.role;
        }
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) {
        session.user.id = token.sub as string;
        if (token.isPlatformAdmin) {
          session.user.isPlatformAdmin = true;
        } else {
          session.user.orgId = token.orgId as string;
          session.user.orgSlug = token.orgSlug as string;
          session.user.orgName = token.orgName as string;
          session.user.role = token.role as string;
        }
      }
      return session;
    },
  },
});
