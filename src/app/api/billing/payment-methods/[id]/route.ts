import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { setDefaultPaymentMethod, removePaymentMethod } from "@/lib/billing/payment-methods";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const member = await requireOrgMember(UserRole.ADMIN);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (body.isDefault) {
      await setDefaultPaymentMethod(member.orgId, id);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (err instanceof Error && err.message === "Payment method not found") {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update payment method" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const member = await requireOrgMember(UserRole.ADMIN);
    const { id } = await params;
    await removePaymentMethod(member.orgId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (err instanceof Error && err.message === "Payment method not found") {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to remove payment method" }, { status: 500 });
  }
}
