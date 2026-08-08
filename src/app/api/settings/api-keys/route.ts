import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgMember } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { generateApiKey, hashApiKey } from "@/lib/api-key-auth";

const createSchema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.enum(["read", "write", "contacts", "appointments"])).default(["read"]),
  expiresAt: z.string().datetime().optional().nullable(),
});

export async function GET() {
  const member = await requireOrgMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const keys = await prisma.apiKey.findMany({
    where: { orgId: member.orgId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, scopes: true, lastUsedAt: true, expiresAt: true, isActive: true, createdAt: true },
  });
  return NextResponse.json({ keys });
}

export async function POST(req: Request) {
  const member = await requireOrgMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const plaintext = generateApiKey();
  const key = await prisma.apiKey.create({
    data: {
      orgId: member.orgId,
      createdByUserId: member.userId,
      name: parsed.data.name,
      keyHash: hashApiKey(plaintext),
      scopes: parsed.data.scopes,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    },
    select: { id: true, name: true, scopes: true, expiresAt: true, createdAt: true },
  });

  return NextResponse.json({ key: { ...key, plaintext } }, { status: 201 });
}
