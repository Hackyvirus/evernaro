import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { getPaymentMethods } from "@/lib/billing/payment-methods";

export async function GET() {
  try {
    const member = await requireOrgMember(UserRole.ADMIN);
    const methods = await getPaymentMethods(member.orgId);
    return NextResponse.json({ methods });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load payment methods" }, { status: 500 });
  }
}
