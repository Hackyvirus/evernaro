import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getOrCreateWallet } from "@/lib/whatsapp-wallet";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";

export async function GET() {
  try {
    const { orgId } = await requireOrgMember(UserRole.VIEWER);
    const wallet = await getOrCreateWallet(orgId);
    return NextResponse.json({ wallet });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load wallet" }, { status: 500 });
  }
}
