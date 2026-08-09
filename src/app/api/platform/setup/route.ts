import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

// First-run bootstrap only: creates the one platform admin account. Refuses
// to run again once any PlatformAdmin exists — there's no invite/add-admin
// flow yet by design (single super-admin, per the current scope).
//
// Requires PLATFORM_SETUP_TOKEN from env to prevent a random visitor from
// owning the platform on a fresh deploy before the admin is created.
const bodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  setupToken: z.string().min(1),
});

export async function POST(req: Request) {
  const expectedToken = process.env.PLATFORM_SETUP_TOKEN;
  if (!expectedToken) {
    return NextResponse.json(
      { error: "Platform setup token is not configured" },
      { status: 503 }
    );
  }

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
  const { name, email, password, setupToken } = parsed.data;

  const providedHash = crypto.createHash("sha256").update(setupToken).digest();
  const expectedHash = crypto.createHash("sha256").update(expectedToken).digest();
  if (providedHash.length !== expectedHash.length || !crypto.timingSafeEqual(providedHash, expectedHash)) {
    return NextResponse.json({ error: "Invalid setup token" }, { status: 403 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.platformAdmin.create({
    data: { name, email: email.toLowerCase(), passwordHash },
  });

  return NextResponse.json({ ok: true });
}
