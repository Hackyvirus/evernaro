import { NextResponse } from "next/server";
import { getOrgInvoices } from "@/lib/billing/invoice";
import { requireOrgMember, UnauthorizedError } from "@/lib/session";
import { UserRole } from "@prisma/client";

export async function GET() {
  try {
    const member = await requireOrgMember(UserRole.VIEWER);
    const invoices = await getOrgInvoices(member.orgId);
    return NextResponse.json({ invoices });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load invoices" }, { status: 500 });
  }
}
