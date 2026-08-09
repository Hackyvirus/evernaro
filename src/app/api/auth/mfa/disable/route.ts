import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgUser } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { decryptSecret } from "@/lib/crypto";
import { verifyTotpCode } from "@/lib/totp";

const schema = z.object({ password: z.string().min(1), code: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const { userId } = await requireOrgUser();

    const allowed = await checkRateLimit(`mfa:disable:${userId}`, 5, 60 * 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, mfaEnabled: true, mfaSecret: true, mfaBackupCodes: true },
    });
    if (!user || !user.mfaEnabled) {
      return NextResponse.json({ error: "MFA is not enabled" }, { status: 400 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Password and MFA code are required" }, { status: 400 });
    }

    const validPassword = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!validPassword) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 400 });
    }

    const code = parsed.data.code.replace(/\s/g, "").trim();
    const isBackupCode = /^\d{9}$/.test(code);
    let mfaOk = false;
    if (isBackupCode) {
      for (const hash of user.mfaBackupCodes) {
        if (await bcrypt.compare(code, hash)) {
          mfaOk = true;
          await prisma.user.update({
            where: { id: userId },
            data: { mfaBackupCodes: { set: user.mfaBackupCodes.filter((h) => h !== hash) } },
          });
          break;
        }
      }
    } else if (user.mfaSecret) {
      mfaOk = verifyTotpCode(decryptSecret(user.mfaSecret), code);
    }
    if (!mfaOk) {
      return NextResponse.json({ error: "Invalid MFA code" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaTempSecret: null,
        mfaBackupCodes: [],
        tokenVersion: { increment: 1 },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
