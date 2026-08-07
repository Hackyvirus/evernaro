import { PrismaClient, BillingFrequency, CouponDuration, CouponType } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL },
  },
});

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function seedBillingCatalog() {
  const services = [
    { key: "conversations", name: "WhatsApp Conversations", unit: "conversation", description: "Inbound/outbound WhatsApp 24h conversation windows", category: "Messaging" },
    { key: "contacts", name: "Contacts", unit: "contact", description: "Imported and managed contacts", category: "CRM" },
    { key: "users", name: "Team Users", unit: "user", description: "Staff seats with dashboard access", category: "Platform" },
    { key: "campaigns", name: "Campaigns", unit: "campaign", description: "Broadcast campaigns per month", category: "Marketing" },
    { key: "storage_mb", name: "File Storage", unit: "MB", description: "Media and attachment storage", category: "Storage" },
  ];

  for (const svc of services) {
    await prisma.billableService.upsert({
      where: { key: svc.key },
      update: svc,
        create: { ...svc, billingType: "USAGE_TIER", basePriceInr: 0 },
    });
  }
  console.log(`Seeded ${services.length} billable services.`);

  const serviceMap = Object.fromEntries((await prisma.billableService.findMany()).map((s) => [s.key, s]));

  const addOns = [
    { name: "Extra WhatsApp Pack", description: "1,000 additional conversation windows", priceInr: 999, frequency: BillingFrequency.MONTHLY, minQuantity: 1, maxQuantity: 10 },
    { name: "Extra Team Seats", description: "5 additional staff users", priceInr: 499, frequency: BillingFrequency.MONTHLY, minQuantity: 1, maxQuantity: 20 },
    { name: "Priority Support", description: "24x7 priority support and onboarding", priceInr: 1999, frequency: BillingFrequency.MONTHLY, minQuantity: 1, maxQuantity: 1 },
  ];

  const addOnRecords: Record<string, { id: string; name: string; priceInr: number; frequency: BillingFrequency; minQuantity: number; maxQuantity: number | null }> = {};
  for (const a of addOns) {
    const slug = slugify(a.name);
    const record = await prisma.addOn.upsert({
      where: { slug },
      update: { ...a, slug },
      create: { ...a, slug },
    });
    addOnRecords[record.id] = record;
  }
  console.log(`Seeded ${addOns.length} add-ons.`);

  const plans = [
    {
      slug: "free",
      name: "Free",
      description: "For individuals exploring the platform.",
      monthlyPriceInr: 0,
      annualPriceInr: 0,
      trialDays: 0,
      displayOrder: 10,
      limits: [
        { serviceKey: "conversations", includedQuantity: 50, overagePriceInr: 2 },
        { serviceKey: "contacts", includedQuantity: 100 },
        { serviceKey: "users", includedQuantity: 1 },
        { serviceKey: "campaigns", includedQuantity: 2 },
        { serviceKey: "storage_mb", includedQuantity: 100 },
      ],
      features: [
        { key: "whatsapp_inbox", label: "WhatsApp Inbox", included: true },
        { key: "contacts", label: "Contact Management", included: true },
        { key: "basic_automations", label: "Basic Automations", included: true },
      ],
      addOns: [] as string[],
    },
    {
      slug: "starter",
      name: "Starter",
      description: "For small local businesses getting started.",
      monthlyPriceInr: 499,
      annualPriceInr: 4990,
      trialDays: 14,
      displayOrder: 20,
      limits: [
        { serviceKey: "conversations", includedQuantity: 500, overagePriceInr: 150 },
        { serviceKey: "contacts", includedQuantity: 2000 },
        { serviceKey: "users", includedQuantity: 3 },
        { serviceKey: "campaigns", includedQuantity: 10 },
        { serviceKey: "storage_mb", includedQuantity: 1000 },
      ],
      features: [
        { key: "whatsapp_inbox", label: "WhatsApp Inbox", included: true },
        { key: "contacts", label: "Contact Management", included: true },
        { key: "automations", label: "Advanced Automations", included: true },
        { key: "campaigns", label: "Broadcast Campaigns", included: true },
        { key: "basic_support", label: "Email Support", included: true },
      ],
      addOns: ["extra-whatsapp-pack", "extra-team-seats"],
    },
    {
      slug: "growth",
      name: "Growth",
      description: "For growing businesses that need more power.",
      monthlyPriceInr: 1499,
      annualPriceInr: 14990,
      trialDays: 14,
      displayOrder: 30,
      limits: [
        { serviceKey: "conversations", includedQuantity: 2000, overagePriceInr: 100 },
        { serviceKey: "contacts", includedQuantity: 10000 },
        { serviceKey: "users", includedQuantity: 8 },
        { serviceKey: "campaigns", includedQuantity: 50 },
        { serviceKey: "storage_mb", includedQuantity: 5000 },
      ],
      features: [
        { key: "whatsapp_inbox", label: "WhatsApp Inbox", included: true },
        { key: "contacts", label: "Contact Management", included: true },
        { key: "automations", label: "Advanced Automations", included: true },
        { key: "campaigns", label: "Broadcast Campaigns", included: true },
        { key: "ai_assistant", label: "AI Assistant", included: true },
        { key: "analytics", label: "Business Analytics", included: true },
        { key: "priority_support", label: "Priority Support", included: true },
      ],
      addOns: ["extra-whatsapp-pack", "extra-team-seats", "priority-support"],
    },
    {
      slug: "business",
      name: "Business",
      description: "For multi-location teams and franchises.",
      monthlyPriceInr: 3999,
      annualPriceInr: 39990,
      trialDays: 14,
      displayOrder: 40,
      limits: [
        { serviceKey: "conversations", includedQuantity: 10000, overagePriceInr: 75 },
        { serviceKey: "contacts", includedQuantity: 50000 },
        { serviceKey: "users", includedQuantity: 25 },
        { serviceKey: "campaigns", includedQuantity: 200 },
        { serviceKey: "storage_mb", includedQuantity: 25000 },
      ],
      features: [
        { key: "whatsapp_inbox", label: "WhatsApp Inbox", included: true },
        { key: "contacts", label: "Contact Management", included: true },
        { key: "automations", label: "Advanced Automations", included: true },
        { key: "campaigns", label: "Broadcast Campaigns", included: true },
        { key: "ai_assistant", label: "AI Assistant", included: true },
        { key: "analytics", label: "Business Analytics", included: true },
        { key: "api_access", label: "API Access", included: true },
        { key: "multi_location", label: "Multi-location", included: true },
        { key: "dedicated_support", label: "Dedicated Support", included: true },
      ],
      addOns: ["extra-whatsapp-pack", "extra-team-seats", "priority-support"],
    },
    {
      slug: "enterprise",
      name: "Enterprise",
      description: "Custom pricing for large-scale deployments.",
      monthlyPriceInr: 0,
      annualPriceInr: 0,
      trialDays: 0,
      displayOrder: 50,
      isCustom: true,
      limits: [
        { serviceKey: "conversations", includedQuantity: 0 },
        { serviceKey: "contacts", includedQuantity: 0 },
        { serviceKey: "users", includedQuantity: 0 },
        { serviceKey: "campaigns", includedQuantity: 0 },
        { serviceKey: "storage_mb", includedQuantity: 0 },
      ],
      features: [
        { key: "everything", label: "Everything in Business", included: true },
        { key: "custom_sla", label: "Custom SLA", included: true },
        { key: "dedicated_csm", label: "Dedicated CSM", included: true },
        { key: "custom_integrations", label: "Custom Integrations", included: true },
      ],
      addOns: [] as string[],
    },
  ];

  for (const p of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        description: p.description,
        monthlyPriceInr: p.monthlyPriceInr,
        annualPriceInr: p.annualPriceInr,
        trialDays: p.trialDays,
        displayOrder: p.displayOrder,
        isCustom: p.isCustom ?? false,
      },
      create: {
        slug: p.slug,
        name: p.name,
        description: p.description,
        monthlyPriceInr: p.monthlyPriceInr,
        annualPriceInr: p.annualPriceInr,
        trialDays: p.trialDays,
        displayOrder: p.displayOrder,
        isCustom: p.isCustom ?? false,
      },
    });

    const plan = await prisma.subscriptionPlan.findUnique({ where: { slug: p.slug } });
    if (!plan) continue;

    await prisma.planLimit.deleteMany({ where: { planId: plan.id } });
    await prisma.planLimit.createMany({
      data: p.limits.map((l) => ({
        planId: plan.id,
        serviceId: serviceMap[l.serviceKey].id,
        includedQuantity: l.includedQuantity,
        overagePriceInr: ("overagePriceInr" in l ? l.overagePriceInr : null) ?? null,
      })),
    });

    await prisma.planFeature.deleteMany({ where: { planId: plan.id } });
    await prisma.planFeature.createMany({
      data: p.features.map((f) => ({
        planId: plan.id,
        key: f.key,
        label: f.label,
        value: null,
        included: f.included ?? true,
      })),
    });

    await prisma.planAddOn.deleteMany({ where: { planId: plan.id } });
    if (p.addOns.length > 0) {
      const addOnIds: string[] = [];
      for (const slug of p.addOns) {
        const addOn = await prisma.addOn.findUnique({ where: { slug } });
        if (addOn) addOnIds.push(addOn.id);
      }
      if (addOnIds.length > 0) {
        await prisma.planAddOn.createMany({ data: addOnIds.map((addOnId) => ({ planId: plan.id, addOnId })) });
      }
    }
  }
  console.log(`Seeded ${plans.length} subscription plans.`);

  await prisma.taxConfiguration.upsert({
    where: { id: "default_tax" },
    update: {},
    create: { id: "default_tax", name: "GST", rate: 18, inclusive: false, enabled: true },
  });
  console.log("Seeded default GST tax configuration.");

  // Demo coupon
  await prisma.coupon.upsert({
    where: { code: "EVERREACH20" },
    update: {},
    create: {
      code: "EVERREACH20",
      description: "20% off your first subscription",
      type: CouponType.PERCENTAGE,
      value: 20,
      duration: CouponDuration.ONCE,
      maxRedemptions: 100,
      minAmountInr: 499,
    },
  });
  console.log("Seeded demo coupon.");
}

if (require.main === module) {
  seedBillingCatalog()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
