import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireOrgMember } from "@/lib/session";
import { setDefaultPaymentMethod, removePaymentMethod } from "@/lib/billing/payment-methods";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await requireOrgMember(UserRole.ADMIN);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.isDefault) {
    await setDefaultPaymentMethod(member.orgId, id);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await requireOrgMember(UserRole.ADMIN);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await removePaymentMethod(member.orgId, id);
  return NextResponse.json({ ok: true });
}
