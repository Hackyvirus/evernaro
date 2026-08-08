import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getActiveSubscription,
  cancelSubscription,
  changeSubscriptionPlan,
  reactivateSubscription,
} from "@/lib/billing/subscription-service";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { UserRole, BillingFrequency } from "@prisma/client";

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

const cancelSchema = z.object({
  cancelAtPeriodEnd: z.boolean().default(true),
});

export async function DELETE(req: Request) {
  try {
    const member = await requireOrgMember(UserRole.ADMIN);
    const parsed = cancelSchema.safeParse(await req.json().catch(() => ({})));
    const subscription = await cancelSubscription(
      member.orgId,
      parsed.success ? parsed.data.cancelAtPeriodEnd : true
    );
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

const changeSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("change"),
    planId: z.string().cuid(),
    frequency: z.nativeEnum(BillingFrequency).optional(),
    addOns: z
      .array(z.object({ addOnId: z.string().cuid(), quantity: z.number().int().positive() }))
      .optional(),
    couponCode: z.string().optional().nullable(),
    prorate: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("reactivate"),
  }),
]);

export async function PATCH(req: Request) {
  try {
    const member = await requireOrgMember(UserRole.ADMIN);
    const parsed = changeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    if (parsed.data.action === "reactivate") {
      const subscription = await reactivateSubscription(member.orgId);
      return NextResponse.json({ subscription });
    }

    const user = await (await import("@/lib/prisma")).prisma.user.findUnique({
      where: { id: member.userId },
      select: { email: true, name: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const result = await changeSubscriptionPlan({
      orgId: member.orgId,
      ownerEmail: user.email,
      ownerName: user.name ?? "Account Owner",
      planId: parsed.data.planId,
      frequency: parsed.data.frequency,
      addOns: parsed.data.addOns,
      couponCode: parsed.data.couponCode,
      prorate: parsed.data.prorate,
    });

    return NextResponse.json(result, { status: 200 });
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
    return NextResponse.json({ error: "Failed to change subscription" }, { status: 500 });
  }
}
