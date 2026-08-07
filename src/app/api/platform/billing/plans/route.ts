import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdminId, UnauthorizedError } from "@/lib/session";

export async function GET() {
  try {
    await requirePlatformAdminId();
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { monthlyPriceInr: "asc" },
      include: {
        features: true,
        limits: { include: { service: true } },
        planAddOns: { include: { addOn: true } },
        _count: { select: { subscriptions: true } },
      },
    });
    return NextResponse.json({ plans });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load plans" }, { status: 500 });
  }
}

const limitSchema = z.object({
  serviceId: z.string().cuid(),
  includedQuantity: z.number().int().nonnegative(),
  overagePriceInr: z.number().nonnegative().optional(),
});

const featureSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.string().optional(),
  included: z.boolean().optional(),
});

const bodySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  monthlyPriceInr: z.number().int().nonnegative(),
  annualPriceInr: z.number().int().nonnegative(),
  currency: z.string().default("INR"),
  trialDays: z.number().int().nonnegative().default(0),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  isCustom: z.boolean().default(false),
  limits: z.array(limitSchema).default([]),
  features: z.array(featureSchema).default([]),
  addOnIds: z.array(z.string().cuid()).default([]),
});

export async function POST(req: Request) {
  try {
    await requirePlatformAdminId();
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { limits, features, addOnIds, ...planData } = parsed.data;

    const plan = await prisma.subscriptionPlan.create({
      data: {
        ...planData,
        limits: { create: limits },
        features: { create: features },
        planAddOns: { create: addOnIds.map((id) => ({ addOnId: id })) },
      },
      include: { limits: { include: { service: true } }, features: true, planAddOns: true },
    });

    return NextResponse.json({ plan }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to create plan:", err);
    return NextResponse.json({ error: "Failed to create plan" }, { status: 500 });
  }
}
