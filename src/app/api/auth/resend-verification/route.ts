import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { generateSecureToken, hoursFromNow } from "@/lib/token";
import { sendVerificationEmail } from "@/lib/auth-email";

const schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const allowed = await checkRateLimit(`resend-verification:${clientIp(req)}`, 5, 60 * 60);
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts — try again later." }, { status: 429 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerified) {
    // Don't reveal whether the email exists or is already verified.
    return NextResponse.json({ ok: true });
  }

  const token = generateSecureToken();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationToken: token,
      emailVerificationTokenExpiresAt: hoursFromNow(24),
    },
  });

  try {
    await sendVerificationEmail(email, token);
  } catch {
    console.error("Failed to resend verification email to", email);
  }

  return NextResponse.json({ ok: true });
}
