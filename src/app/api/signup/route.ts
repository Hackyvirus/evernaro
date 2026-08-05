import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { generateSecureToken, hoursFromNow } from "@/lib/token";
import { sendVerificationEmail } from "@/lib/auth-email";

const signupSchema = z.object({
  orgName: z.string().min(2),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "org"
  );
}

export async function POST(req: Request) {
  const allowed = await checkRateLimit(`signup:${clientIp(req)}`, 5, 60 * 60);
  if (!allowed) {
    return NextResponse.json({ error: "Too many signup attempts — try again later." }, { status: 429 });
  }

  const body = await req.json();
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { orgName, name, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
  }

  const baseSlug = slugify(orgName);
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.organization.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${++suffix}`;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const verificationToken = generateSecureToken();

  await prisma.organization.create({
    data: {
      name: orgName,
      slug,
      users: {
        create: {
          email: normalizedEmail,
          passwordHash,
          name,
          role: "OWNER",
          emailVerificationToken: verificationToken,
          emailVerificationTokenExpiresAt: hoursFromNow(24),
        },
      },
      businessProfile: {
        create: {
          businessName: orgName,
          description: "",
        },
      },
    },
  });

  try {
    await sendVerificationEmail(normalizedEmail, verificationToken);
  } catch {
    // Don't fail signup if email is misconfigured in this environment; the
    // user can request a fresh verification email from the login page.
    console.error("Failed to send verification email to", normalizedEmail);
  }

  return NextResponse.json({ ok: true });
}
