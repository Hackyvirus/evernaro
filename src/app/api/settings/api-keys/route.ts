import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { generateApiKey, hashApiKey, apiKeyPrefix } from "@/lib/api-key-auth";

const createSchema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.enum(["read", "write", "contacts", "appointments"])).default(["read"]),
  expiresAt: z.string().datetime().optional().nullable(),
});

export async function GET() {
  try {
    const member = await requireOrgMember(UserRole.ADMIN);
    const keys = await prisma.apiKey.findMany({
      where: { orgId: member.orgId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, scopes: true, lastUsedAt: true, expiresAt: true, isActive: true, createdAt: true },
    });
    return NextResponse.json({ keys });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load API keys" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const member = await requireOrgMember(UserRole.ADMIN);

    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const plaintext = generateApiKey();
    const keyHash = await hashApiKey(plaintext);
    const keyPrefix = apiKeyPrefix(plaintext);
    const key = await prisma.apiKey.create({
      data: {
        orgId: member.orgId,
        createdByUserId: member.userId,
        name: parsed.data.name,
        keyHash,
        keyPrefix,
        scopes: parsed.data.scopes,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      },
      select: { id: true, name: true, scopes: true, expiresAt: true, createdAt: true },
    });

    return NextResponse.json({ key: { ...key, plaintext } }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }
}
