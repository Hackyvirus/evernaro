import { NextResponse } from "next/server";
import { z } from "zod";
import { createSubscription } from "@/lib/billing/subscription-service";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { UserRole, BillingFrequency } from "@prisma/client";

const bodySchema = z.object({
  planId: z.string().cuid(),
  frequency: z.nativeEnum(BillingFrequency).optional(),
  addOns: z.array(z.object({ addOnId: z.string().cuid(), quantity: z.number().int().positive() })).optional(),
  couponCode: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const member = await requireOrgMember(UserRole.ADMIN);
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const user = await (await import("@/lib/prisma")).prisma.user.findUnique({
      where: { id: member.userId },
      select: { email: true, name: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const result = await createSubscription({
      orgId: member.orgId,
      ownerEmail: user.email,
      ownerName: user.name ?? "Account Owner",
      ...parsed.data,
    });

    return NextResponse.json(result, { status: 201 });
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
    return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 });
  }
}
