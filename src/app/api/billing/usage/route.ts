import { NextResponse } from "next/server";
import { getOrgUsageSummary } from "@/lib/billing/usage";
import { requireOrgMember, UnauthorizedError } from "@/lib/session";
import { UserRole } from "@prisma/client";

export async function GET() {
  try {
    const member = await requireOrgMember(UserRole.VIEWER);
    const usage = await getOrgUsageSummary(member.orgId);
    return NextResponse.json({ usage });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load usage" }, { status: 500 });
  }
}
