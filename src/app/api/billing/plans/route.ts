import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      include: {
        features: { orderBy: { label: "asc" } },
        limits: { include: { service: true } },
        planAddOns: { where: { isActive: true }, include: { addOn: true } },
      },
    });

    const result = plans.map((plan) => ({
      id: plan.id,
      slug: plan.slug,
      name: plan.name,
      description: plan.description,
      monthlyPriceInr: plan.monthlyPriceInr,
      annualPriceInr: plan.annualPriceInr,
      currency: plan.currency,
      trialDays: plan.trialDays,
      isCustom: plan.isCustom,
      features: plan.features,
      limits: plan.limits.map((l) => ({
        serviceKey: l.service.key,
        serviceName: l.service.name,
        unit: l.service.unit,
        includedQuantity: l.includedQuantity,
        overagePriceInr: l.overagePriceInr,
      })),
      addOns: plan.planAddOns.map((pa) => ({
        id: pa.addOn.id,
        slug: pa.addOn.slug,
        name: pa.addOn.name,
        description: pa.addOn.description,
        priceInr: pa.addOn.priceInr,
        frequency: pa.addOn.frequency,
        minQuantity: pa.addOn.minQuantity,
        maxQuantity: pa.addOn.maxQuantity,
      })),
    }));

    return NextResponse.json({ plans: result });
  } catch (err) {
    console.error("Failed to load plans:", err);
    return NextResponse.json({ error: "Failed to load plans" }, { status: 500 });
  }
}
