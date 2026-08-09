import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireOrgMember } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const locationSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  isDefault: z.boolean().default(false),
});

export async function GET() {
  const member = await requireOrgMember(UserRole.ADMIN);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const locations = await prisma.location.findMany({
    where: { orgId: member.orgId },
    orderBy: { isDefault: "desc" },
  });
  return NextResponse.json({ locations });
}

export async function POST(req: Request) {
  const member = await requireOrgMember(UserRole.ADMIN);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = locationSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  if (parsed.data.isDefault) {
    await prisma.location.updateMany({ where: { orgId: member.orgId }, data: { isDefault: false } });
  }

  const location = await prisma.location.create({
    data: { orgId: member.orgId, ...parsed.data },
  });

  // If this is the first location, make it the org's active location.
  const org = await prisma.organization.findUnique({ where: { id: member.orgId }, select: { activeLocationId: true } });
  if (!org?.activeLocationId) {
    await prisma.organization.update({ where: { id: member.orgId }, data: { activeLocationId: location.id } });
  }

  return NextResponse.json({ location }, { status: 201 });
}
