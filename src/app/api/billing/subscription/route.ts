import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveSubscription, cancelSubscription } from "@/lib/billing/subscription-service";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { UserRole } from "@prisma/client";

export async function GET() {
  try {
    const member = await requireOrgMember(UserRole.VIEWER);
    const subscription = await getActiveSubscription(member.orgId);
    return NextResponse.json({ subscription });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load subscription" }, { status: 500 });
  }
}

const bodySchema = z.object({
  cancelAtPeriodEnd: z.boolean().default(true),
});

export async function DELETE(req: Request) {
  try {
    const member = await requireOrgMember(UserRole.ADMIN);
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    const subscription = await cancelSubscription(member.orgId, parsed.success ? parsed.data.cancelAtPeriodEnd : true);
    return NextResponse.json({ subscription });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 });
  }
}
