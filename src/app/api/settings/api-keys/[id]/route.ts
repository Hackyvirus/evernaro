import { NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await requireOrgMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.apiKey.updateMany({ where: { id, orgId: member.orgId }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
