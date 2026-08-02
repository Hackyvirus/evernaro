import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// First-run bootstrap only: creates the one platform admin account. Refuses
// to run again once any PlatformAdmin exists — there's no invite/add-admin
// flow yet by design (single super-admin, per the current scope).
const bodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  const existing = await prisma.platformAdmin.findFirst();
  if (existing) {
    return NextResponse.json({ error: "A platform admin already exists" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { name, email, password } = parsed.data;

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.platformAdmin.create({
    data: { name, email: email.toLowerCase(), passwordHash },
  });

  return NextResponse.json({ ok: true });
}
