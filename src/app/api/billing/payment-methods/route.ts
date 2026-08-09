import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireOrgMember } from "@/lib/session";
import { getPaymentMethods } from "@/lib/billing/payment-methods";

export async function GET() {
  const member = await requireOrgMember(UserRole.ADMIN);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const methods = await getPaymentMethods(member.orgId);
  return NextResponse.json({ methods });
}
