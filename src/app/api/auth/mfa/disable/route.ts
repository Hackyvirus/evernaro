import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgUser } from "@/lib/session";

const schema = z.object({ password: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const { userId } = await requireOrgUser();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, mfaEnabled: true },
    });
    if (!user || !user.mfaEnabled) {
      return NextResponse.json({ error: "MFA is not enabled" }, { status: 400 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaTempSecret: null,
        mfaBackupCodes: [],
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
