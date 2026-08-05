import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({ token: z.string().min(1) });

export async function POST(req: Request) {
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
    },
  });

  return NextResponse.json({ ok: true });
}
