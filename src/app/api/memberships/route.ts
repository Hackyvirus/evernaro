import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole, MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";

const createSchema = z.object({
  contactId: z.string().min(1),
  name: z.string().min(1),
  sessionsTotal: z.coerce.number().int().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
  status: z.enum(["ACTIVE", "EXPIRED", "CANCELLED"]).optional(),
});

export async function GET() {
  try {
    const { orgId } = await requireOrgMember(UserRole.VIEWER);
    const memberships = await prisma.membership.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      include: { contact: { select: { id: true, name: true, email: true, phone: true, telegramChatId: true, instagramUserId: true } } },
    });
    return NextResponse.json({ memberships });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load memberships" }, { status: 500 });
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

    const { contactId, name, sessionsTotal, expiresAt, status } = parsed.data;
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, orgId },
      select: { id: true },
    });
    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const membership = await prisma.membership.create({
      data: {
        orgId,
        contactId,
        name,
        sessionsTotal: sessionsTotal ?? null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        status: status ?? MembershipStatus.ACTIVE,
      },
      include: { contact: { select: { id: true, name: true, email: true, phone: true, telegramChatId: true, instagramUserId: true } } },
    });

    return NextResponse.json({ membership }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to create membership" }, { status: 500 });
  }
}
