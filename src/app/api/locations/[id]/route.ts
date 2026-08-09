import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireOrgMember } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const locationSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await requireOrgMember(UserRole.ADMIN);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsed = locationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  if (parsed.data.isDefault) {
    await prisma.location.updateMany({ where: { orgId: member.orgId }, data: { isDefault: false } });
  }

  const location = await prisma.location.updateMany({
    where: { id, orgId: member.orgId },
    data: parsed.data,
  });
  if (location.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await requireOrgMember(UserRole.ADMIN);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.location.updateMany({ where: { id, orgId: member.orgId }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
