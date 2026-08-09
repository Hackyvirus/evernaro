import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdminId, UnauthorizedError } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { AuditLogAction } from "@prisma/client";

const limitSchema = z.object({
  id: z.string().cuid().optional(),
  serviceId: z.string().cuid(),
  includedQuantity: z.number().int().nonnegative(),
  overagePriceInr: z.number().nonnegative().optional(),
});

const featureSchema = z.object({
  id: z.string().cuid().optional(),
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.string().optional(),
  included: z.boolean().optional(),
});

const bodySchema = z.object({
  slug: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  monthlyPriceInr: z.number().int().nonnegative().optional(),
  annualPriceInr: z.number().int().nonnegative().optional(),
  currency: z.string().optional(),
  trialDays: z.number().int().nonnegative().optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  isCustom: z.boolean().optional(),
  limits: z.array(limitSchema).optional(),
  features: z.array(featureSchema).optional(),
  addOnIds: z.array(z.string().cuid()).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminId = await requirePlatformAdminId();
    const { id } = await params;
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { limits, features, addOnIds, ...planFields } = parsed.data;

    await prisma.$transaction(async (tx) => {
      await tx.subscriptionPlan.update({ where: { id }, data: planFields });

      if (limits) {
        await tx.planLimit.deleteMany({ where: { planId: id } });
        await tx.planLimit.createMany({ data: limits.map((l) => ({ planId: id, ...l, id: undefined })) });
      }

      if (features) {
        await tx.planFeature.deleteMany({ where: { planId: id } });
        await tx.planFeature.createMany({
          data: features.map((f) => ({ planId: id, ...f, id: undefined })),
        });
      }

      if (addOnIds) {
        await tx.planAddOn.deleteMany({ where: { planId: id } });
        await tx.planAddOn.createMany({ data: addOnIds.map((addOnId) => ({ planId: id, addOnId })) });
      }
    });

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id },
      include: { limits: { include: { service: true } }, features: true, planAddOns: { include: { addOn: true } } },
    });

    await logAudit({
      platformAdminId: adminId,
      action: AuditLogAction.ORG_PLAN_CHANGED,
      targetType: "SubscriptionPlan",
      targetId: id,
      metadata: { action: "UPDATE", fields: Object.keys(parsed.data ?? {}) },
    });

    return NextResponse.json({ plan });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to update plan:", err);
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminId = await requirePlatformAdminId();
    const { id } = await params;
    const activeSubscriptions = await prisma.customerSubscription.count({
      where: { planId: id, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE", "PAUSED"] } },
    });
    if (activeSubscriptions > 0) {
      return NextResponse.json(
        { error: "Cannot delete a plan with active subscriptions" },
        { status: 409 }
      );
    }
    await prisma.subscriptionPlan.delete({ where: { id } });

    await logAudit({
      platformAdminId: adminId,
      action: AuditLogAction.ORG_PLAN_CHANGED,
      targetType: "SubscriptionPlan",
      targetId: id,
      metadata: { action: "DELETE" },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to delete plan:", err);
    return NextResponse.json({ error: "Failed to delete plan" }, { status: 500 });
  }
}
