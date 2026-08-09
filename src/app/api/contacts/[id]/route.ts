import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { normalizePhone } from "@/lib/phone";

const contactPatchSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  company: z.string().optional(),
  tags: z.array(z.string()).optional(),
}).strict();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await requireOrgMember(UserRole.VIEWER);
    const { id } = await params;

    const contact = await prisma.contact.findFirst({
      where: { id, orgId },
      include: {
        _count: { select: { conversations: true, campaignRecipients: true, reminders: true } },
      },
    });
    if (!contact) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ contact });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load contact" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId, userId } = await requireOrgMember(UserRole.AGENT);
    const { id } = await params;

    const parsed = contactPatchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { name, email, phone, notes, tags, company } = parsed.data;

    const existing = await prisma.contact.findFirst({
      where: { id, orgId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updateData: { name?: string | null; email?: string | null; phone?: string | null; notes?: string; company?: string; tags?: string[] } = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email ? email.toLowerCase() : null;
    if (phone !== undefined) updateData.phone = phone ? normalizePhone(phone) : null;
    if (notes !== undefined) updateData.notes = notes;
    if (company !== undefined) updateData.company = company;
    if (tags !== undefined) {
      updateData.tags = tags.filter((t) => t.trim()).map((t) => t.trim());
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
    }

    const updated = await prisma.contact.update({
      where: { id, orgId },
      data: updateData,
    });

    await logAudit({
      orgId,
      userId,
      action: "SETTINGS_CHANGED",
      targetType: "contact",
      targetId: id,
      metadata: { fields: Object.keys(updateData) },
    });

    return NextResponse.json({ contact: updated });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to update contact" }, { status: 500 });
  }
}
