import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";

const deleteSchema = z.object({
  id: z.string().min(1),
});

export async function GET() {
  try {
    const { orgId } = await requireOrgMember(UserRole.VIEWER);
    const reviews = await prisma.review.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      include: { contact: { select: { id: true, name: true, email: true, phone: true, telegramChatId: true, instagramUserId: true } } },
    });
    return NextResponse.json({ reviews });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load reviews" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { orgId } = await requireOrgMember(UserRole.ADMIN);
    const parsed = deleteSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { id } = parsed.data;
    const review = await prisma.review.findFirst({ where: { id, orgId } });
    if (!review) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.review.delete({ where: { id, orgId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to delete review" }, { status: 500 });
  }
}
