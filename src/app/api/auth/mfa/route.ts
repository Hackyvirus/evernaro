import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgUser } from "@/lib/session";
import { encryptSecret } from "@/lib/crypto";
import { generateTotpSecret, generateBackupCodes, verifyTotpCode } from "@/lib/totp";

export async function GET() {
  try {
    const { userId } = await requireOrgUser();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true },
    });
    return NextResponse.json({ enabled: user?.mfaEnabled ?? false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST() {
  try {
    const { userId } = await requireOrgUser();
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, mfaEnabled: true } });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.mfaEnabled) {
      return NextResponse.json({ error: "MFA is already enabled" }, { status: 400 });
    }

    const { secret, uri } = generateTotpSecret(user.email);
    await prisma.user.update({
      where: { id: userId },
      data: { mfaTempSecret: encryptSecret(secret) },
    });

    return NextResponse.json({ uri });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

const verifySchema = z.object({ code: z.string().min(1) });

export async function PUT(req: Request) {
  try {
    const { userId } = await requireOrgUser();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mfaTempSecret: true, mfaEnabled: true, email: true },
    });
    if (!user || !user.mfaTempSecret || user.mfaEnabled) {
      return NextResponse.json({ error: "Invalid setup state" }, { status: 400 });
    }

    const parsed = verifySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    const { decryptSecret } = await import("@/lib/crypto");
    const secret = decryptSecret(user.mfaTempSecret);
    if (!verifyTotpCode(secret, parsed.data.code)) {
      return NextResponse.json({ error: "Invalid authentication code" }, { status: 400 });
    }

    const backupCodes = generateBackupCodes();
    const hashed = backupCodes.map((code) => bcrypt.hashSync(code, 12));

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        mfaSecret: encryptSecret(secret),
        mfaTempSecret: null,
        mfaBackupCodes: hashed,
      },
    });

    return NextResponse.json({ backupCodes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
