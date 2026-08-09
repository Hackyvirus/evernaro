import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { sendWelcomeEmail } from "@/lib/auth-email";

const schema = z.object({ token: z.string().min(1) });

export async function POST(req: Request) {
  const allowed = await checkRateLimit(`verify-email:${clientIp(req)}`, 10, 60 * 60);
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const { token } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { emailVerificationToken: token },
  });
  if (!user || !user.emailVerificationTokenExpiresAt || user.emailVerificationTokenExpiresAt < new Date()) {
    return NextResponse.json({ error: "Verification link is invalid or has expired" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationTokenExpiresAt: null,
      tokenVersion: { increment: 1 },
    },
  });

  try {
    await sendWelcomeEmail(user.email, user.name);
  } catch {
    // Don't fail verification if the welcome email is misconfigured.
    console.error("Failed to send welcome email to", user.email);
  }

  return NextResponse.json({ ok: true });
}
