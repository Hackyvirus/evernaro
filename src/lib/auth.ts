import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { verifyTotpCode } from "@/lib/totp";
import { decryptSecret } from "@/lib/crypto";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

// A valid-format bcrypt hash of a value nobody will ever type, used to keep
// authorize()'s timing constant whether or not the email is registered —
// otherwise "no such user" (fast, no hashing) is distinguishable from "wrong
// password" (slower, hashes) purely by response latency, enabling email
// enumeration.
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO0j0FEEC0MEsAcaZ1EOwLmR2ILzTkoOK";

export class MfaRequiredError extends Error {
  constructor() {
    super("MFA_REQUIRED");
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "Authentication code", type: "text" },
      },
      authorize: async (credentials, request) => {
        const ip = clientIp(request);
        const allowed = await checkRateLimit(`login-failed:${ip}`, 10, 15 * 60);
        if (!allowed) return null;

        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        const totpCode = credentials?.totpCode as string | undefined;
        if (!email || !password) return null;

        const accountAllowed = await checkRateLimit(
          `login-failed:account:${email.toLowerCase()}`,
          5,
          15 * 60,
          { failClosed: true }
        );
        if (!accountAllowed) return null;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: { org: true },
        });

        const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !valid || !user.isActive) return null;

        if (user.mfaEnabled) {
          if (!user.mfaSecret) {
            // MFA is enabled but secret is missing — fail closed.
            return null;
          }
          if (!totpCode) {
            throw new MfaRequiredError();
          }
          const code = totpCode.replace(/\s/g, "").trim();
          // Backup codes are 9 digits; TOTP codes are 6 digits.
          const isBackupCode = /^\d{9}$/.test(code);
          let mfaOk = false;
          if (isBackupCode) {
            for (const hash of user.mfaBackupCodes) {
              if (await bcrypt.compare(code, hash)) {
                mfaOk = true;
                // Burn the used backup code.
                await prisma.user.update({
                  where: { id: user.id },
                  data: {
                    mfaBackupCodes: { set: user.mfaBackupCodes.filter((h) => h !== hash) },
                  },
                });
                break;
              }
            }
          } else {
            const secret = decryptSecret(user.mfaSecret);
            mfaOk = verifyTotpCode(secret, code);
          }
          if (!mfaOk) return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          orgId: user.orgId,
          orgSlug: user.org.slug,
          orgName: user.org.name,
          role: user.role,
          emailVerified: user.emailVerified as boolean,
          tokenVersion: user.tokenVersion,
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
      authorize: async (credentials, request) => {
        const ip = clientIp(request);
        const allowed = await checkRateLimit(`login-failed:${ip}`, 10, 15 * 60);
        if (!allowed) return null;

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
          tokenVersion: admin.tokenVersion,
        };
      },
    }),
  ],
});
