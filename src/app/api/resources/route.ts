import { NextResponse } from "next/server";
import { z } from "zod";
import { ResourceType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";

const createSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(ResourceType).default(ResourceType.OTHER),
  capacity: z.coerce.number().int().min(1).default(1),
  isActive: z.boolean().default(true),
});

export async function GET() {
  try {
    const { orgId } = await requireOrgMember(UserRole.VIEWER);

    const resources = await prisma.resource.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ resources });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load resources" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { orgId } = await requireOrgMember(UserRole.ADMIN);
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const resource = await prisma.resource.create({
      data: {
        orgId,
        name: parsed.data.name,
        type: parsed.data.type,
        capacity: parsed.data.capacity,
        isActive: parsed.data.isActive,
      },
    });

    return NextResponse.json({ resource }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to create resource" }, { status: 500 });
  }
}
