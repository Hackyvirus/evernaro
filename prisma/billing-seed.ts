import { PrismaClient, BillingFrequency, CouponDuration, CouponType } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL },
  },
});

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
    { name: "Extra WhatsApp Pack", slug: "extra-whatsapp-pack", description: "1,000 additional conversation windows", priceInr: 999, frequency: BillingFrequency.MONTHLY, minQuantity: 1, maxQuantity: 10, serviceKey: "conversations" as const, includedQuantity: 1000 },
    { name: "Extra Team Seats", slug: "extra-team-seats", description: "5 additional staff users", priceInr: 499, frequency: BillingFrequency.MONTHLY, minQuantity: 1, maxQuantity: 20, serviceKey: "users" as const, includedQuantity: 5 },
    { name: "Priority Support", slug: "priority-support", description: "24x7 priority support and onboarding", priceInr: 1999, frequency: BillingFrequency.MONTHLY, minQuantity: 1, maxQuantity: 1 },
  ];

  type AddOnRecord = { id: string; name: string; priceInr: number; frequency: BillingFrequency; minQuantity: number; maxQuantity: number | null };
  const addOnRecords: Record<string, AddOnRecord> = {};
  for (const a of addOns) {
    const { serviceKey, includedQuantity, ...rest } = a;
    const record = await prisma.addOn.upsert({
      where: { slug: a.slug },
      update: {
        ...rest,
        serviceId: serviceKey ? serviceMap[serviceKey]?.id ?? null : null,
        includedQuantity: includedQuantity ?? 0,
      },
      create: {
        ...rest,
        serviceId: serviceKey ? serviceMap[serviceKey]?.id ?? null : null,
        includedQuantity: includedQuantity ?? 0,
      },
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
        { serviceKey: "campaigns", includedQuantity: 0 },
        { serviceKey: "storage_mb", includedQuantity: 100 },
      ],
      features: [
        { key: "queue_management", label: "Queue Management", included: true },
        { key: "appointment_management", label: "Appointment Management", included: true },
        { key: "customer_management", label: "Customer Management", included: true },
        { key: "customer_notifications", label: "Customer Notifications", included: true },
        { key: "unified_inbox", label: "Unified Inbox (WhatsApp, Email, Telegram)", included: true },
        { key: "email_support", label: "Email Support", included: true },
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
        { key: "queue_management", label: "Queue Management", included: true },
        { key: "appointment_management", label: "Appointment Management", included: true },
        { key: "customer_management", label: "Customer Management", included: true },
        { key: "customer_notifications", label: "Customer Notifications", included: true },
        { key: "unified_inbox", label: "Unified Inbox (WhatsApp, Email, Telegram)", included: true },
        { key: "email_support", label: "Email Support", included: true },
      ],
      addOns: ["extra-whatsapp-pack", "extra-team-seats"],
    },
    {
      slug: "growth",
      name: "Growth",
      description: "For growing businesses that need automation and analytics.",
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
        // "Everything in Starter" is a real grant, not just marketing copy —
        // hasFeature() matches on `key` against this plan's own rows, with no
        // concept of inheriting another plan's features. Without these,
        // Growth orgs silently fail every Starter-tier entitlement check
        // (e.g. requireFeature(orgId, "appointment_management") 403s) despite
        // the pricing page advertising Growth as including everything Starter has.
        { key: "everything_in_starter", label: "Everything in Starter", included: true },
        { key: "queue_management", label: "Queue Management", included: true },
        { key: "appointment_management", label: "Appointment Management", included: true },
        { key: "customer_management", label: "Customer Management", included: true },
        { key: "customer_notifications", label: "Customer Notifications", included: true },
        { key: "unified_inbox", label: "Unified Inbox (WhatsApp, Email, Telegram)", included: true },
        { key: "email_support", label: "Email Support", included: true },
        { key: "ai_assistant", label: "AI Assistant", included: true },
        { key: "broadcast_campaigns", label: "Broadcast Campaigns", included: true },
        { key: "analytics", label: "Analytics", included: true },
        { key: "staff_management", label: "Staff Management", included: true },
        { key: "automated_reminders", label: "Automated Reminders", included: true },
        { key: "priority_support", label: "Priority Support", included: true },
      ],
      addOns: ["extra-whatsapp-pack", "extra-team-seats", "priority-support"],
    },
    {
      slug: "business",
      name: "Business",
      description: "For larger teams with higher volume.",
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
        // Same reasoning as Growth's "everything_in_starter" above — these
        // are real grants the entitlement checks require, not just copy.
        { key: "everything_in_growth", label: "Everything in Growth", included: true },
        { key: "queue_management", label: "Queue Management", included: true },
        { key: "appointment_management", label: "Appointment Management", included: true },
        { key: "customer_management", label: "Customer Management", included: true },
        { key: "customer_notifications", label: "Customer Notifications", included: true },
        { key: "unified_inbox", label: "Unified Inbox (WhatsApp, Email, Telegram)", included: true },
        { key: "email_support", label: "Email Support", included: true },
        { key: "ai_assistant", label: "AI Assistant", included: true },
        { key: "broadcast_campaigns", label: "Broadcast Campaigns", included: true },
        { key: "analytics", label: "Analytics", included: true },
        { key: "staff_management", label: "Staff Management", included: true },
        { key: "automated_reminders", label: "Automated Reminders", included: true },
        { key: "priority_support", label: "Priority Support", included: true },
        { key: "advanced_analytics", label: "Advanced Analytics", included: true },
        { key: "higher_limits", label: "Higher usage limits", included: true },
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
        // Same reasoning as above — Enterprise must carry every real grant
        // from Business (which itself carries Growth's and Starter's), not
        // just the "Everything in Business" label.
        { key: "everything", label: "Everything in Business", included: true },
        { key: "queue_management", label: "Queue Management", included: true },
        { key: "appointment_management", label: "Appointment Management", included: true },
        { key: "customer_management", label: "Customer Management", included: true },
        { key: "customer_notifications", label: "Customer Notifications", included: true },
        { key: "unified_inbox", label: "Unified Inbox (WhatsApp, Email, Telegram)", included: true },
        { key: "email_support", label: "Email Support", included: true },
        { key: "ai_assistant", label: "AI Assistant", included: true },
        { key: "broadcast_campaigns", label: "Broadcast Campaigns", included: true },
        { key: "analytics", label: "Analytics", included: true },
        { key: "staff_management", label: "Staff Management", included: true },
        { key: "automated_reminders", label: "Automated Reminders", included: true },
        { key: "priority_support", label: "Priority Support", included: true },
        { key: "advanced_analytics", label: "Advanced Analytics", included: true },
        { key: "higher_limits", label: "Higher usage limits", included: true },
        { key: "dedicated_support", label: "Dedicated Support", included: true },
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
