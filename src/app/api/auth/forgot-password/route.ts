import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { generateSecureToken, hoursFromNow } from "@/lib/token";
import { sendPasswordResetEmail } from "@/lib/auth-email";

const schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const allowed = await checkRateLimit(`forgot-password:${clientIp(req)}`, 5, 60 * 60);
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const token = generateSecureToken();
  const expiresAt = hoursFromNow(1);

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    // Always update the token, even if one exists, so a fresh request always works.
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetTokenExpiresAt: expiresAt },
    });
    try {
      await sendPasswordResetEmail(email, token);
    } catch {
      console.error("Failed to send password reset email to", email);
    }
  }

  // Return success even if the email isn't registered to avoid enumeration.
  return NextResponse.json({ ok: true });
}
