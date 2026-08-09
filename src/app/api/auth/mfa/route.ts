import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgUser } from "@/lib/session";
import { encryptSecret } from "@/lib/crypto";
import { checkRateLimit } from "@/lib/rate-limit";
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

const setupSchema = z.object({ password: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const { userId } = await requireOrgUser();

    const allowed = await checkRateLimit(`mfa:setup:${userId}`, 5, 60 * 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    }

    const parsed = setupSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, mfaEnabled: true, passwordHash: true },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.mfaEnabled) {
      return NextResponse.json({ error: "MFA is already enabled" }, { status: 400 });
    }

    const validPassword = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!validPassword) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 400 });
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

const verifySchema = z.object({ code: z.string().min(1), password: z.string().min(1) });

export async function PUT(req: Request) {
  try {
    const { userId } = await requireOrgUser();

    const allowed = await checkRateLimit(`mfa:verify:${userId}`, 5, 15 * 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    }

    const parsed = verifySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Code and password are required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mfaTempSecret: true, mfaEnabled: true, email: true, passwordHash: true },
    });
    if (!user || !user.mfaTempSecret || user.mfaEnabled) {
      return NextResponse.json({ error: "Invalid setup state" }, { status: 400 });
    }

    const validPassword = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!validPassword) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 400 });
    }

    const { decryptSecret } = await import("@/lib/crypto");
    const secret = decryptSecret(user.mfaTempSecret);
    if (!verifyTotpCode(secret, parsed.data.code)) {
      return NextResponse.json({ error: "Invalid authentication code" }, { status: 400 });
    }

    const backupCodes = generateBackupCodes();
    const hashed = await Promise.all(backupCodes.map((code) => bcrypt.hash(code, 12)));

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        mfaSecret: encryptSecret(secret),
        mfaTempSecret: null,
        mfaBackupCodes: hashed,
        tokenVersion: { increment: 1 },
      },
    });

    return NextResponse.json({ backupCodes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
