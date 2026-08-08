import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { sendPlatformAdminPasswordChangedEmail } from "@/lib/auth-email";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  const allowed = await checkRateLimit(`platform-reset-password:${clientIp(req)}`, 5, 60 * 60);
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts — try again later." }, { status: 429 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { token, password } = parsed.data;

  const admin = await prisma.platformAdmin.findUnique({
    where: { passwordResetToken: token },
  });
  if (!admin || !admin.passwordResetTokenExpiresAt || admin.passwordResetTokenExpiresAt < new Date()) {
    return NextResponse.json({ error: "Reset link is invalid or has expired" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.platformAdmin.update({
    where: { id: admin.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetTokenExpiresAt: null,
    },
  });

  try {
    await sendPlatformAdminPasswordChangedEmail(admin.email);
  } catch {
    console.error("Failed to send platform admin password-changed email to", admin.email);
  }

  return NextResponse.json({ ok: true });
}
