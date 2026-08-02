import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdminId, UnauthorizedError } from "@/lib/session";

export async function GET() {
  try {
    await requirePlatformAdminId();

    const organizations = await prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        users: { where: { role: "OWNER" }, take: 1, select: { name: true, email: true } },
        channels: { select: { type: true, isActive: true } },
        _count: { select: { contacts: true, conversations: true } },
        conversations: {
          orderBy: { lastMessageAt: "desc" },
          take: 1,
          select: { lastMessageAt: true },
        },
      },
    });

    const result = organizations.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      createdAt: org.createdAt,
      monthlyFeeInr: org.monthlyFeeInr,
      owner: org.users[0] ?? null,
      channels: org.channels,
      contactCount: org._count.contacts,
      conversationCount: org._count.conversations,
      lastActivityAt: org.conversations[0]?.lastMessageAt ?? null,
    }));

    return NextResponse.json({ organizations: result });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load organizations" }, { status: 500 });
  }
}

const bodySchema = z.object({
  orgName: z.string().min(2),
  ownerName: z.string().min(1),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
  monthlyFeeInr: z.number().int().nonnegative().optional(),
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
  try {
    await requirePlatformAdminId();

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { orgName, ownerName, ownerEmail, ownerPassword, monthlyFeeInr } = parsed.data;

    const existingUser = await prisma.user.findUnique({ where: { email: ownerEmail.toLowerCase() } });
    if (existingUser) {
      return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
    }

    const baseSlug = slugify(orgName);
    let slug = baseSlug;
    let suffix = 1;
    while (await prisma.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${++suffix}`;
    }

    const passwordHash = await bcrypt.hash(ownerPassword, 12);

    const org = await prisma.organization.create({
      data: {
        name: orgName,
        slug,
        monthlyFeeInr: monthlyFeeInr ?? null,
        users: {
          create: { email: ownerEmail.toLowerCase(), passwordHash, name: ownerName, role: "OWNER" },
        },
        businessProfile: { create: { businessName: orgName, description: "" } },
      },
    });

    return NextResponse.json({ ok: true, id: org.id });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
  }
}
