import { PrismaClient, BillingFrequency, BillingType } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL },
  },
});

export async function seedBillingCatalog() {
  // Billable services
  const services = [
    { key: "conversations", name: "WhatsApp Conversations", unit: "conversation", description: "Inbound/outbound WhatsApp 24h conversation windows" },
    { key: "contacts", name: "Contacts", unit: "contact", description: "Imported and managed contacts" },
    { key: "users", name: "Team Users", unit: "user", description: "Staff seats with dashboard access" },
    { key: "campaigns", name: "Campaigns", unit: "campaign", description: "Broadcast campaigns per month" },
    { key: "storage_mb", name: "File Storage", unit: "MB", description: "Media and attachment storage" },
  ];

  for (const svc of services) {
    await prisma.billableService.upsert({
      where: { key: svc.key },
      update: svc,
      create: { ...svc, billingType: BillingType.USAGE, priceInr: 0 },
    });
  }
  console.log(`Seeded ${services.length} billable services.`);

  const serviceMap = Object.fromEntries(
    (await prisma.billableService.findMany()).map((s) => [s.key, s])
  );

  // Add-ons
  const addOns = [
    { name: "Extra WhatsApp Pack", description: "1,000 additional conversation windows", priceInr: 999, frequency: BillingFrequency.MONTHLY, minQuantity: 1, maxQuantity: 10 },
    { name: "Extra Team Seats", description: "5 additional staff users", priceInr: 499, frequency: BillingFrequency.MONTHLY, minQuantity: 1, maxQuantity: 20 },
    { name: "Priority Support", description: "24x7 priority support and onboarding", priceInr: 1999, frequency: BillingFrequency.MONTHLY, minQuantity: 1, maxQuantity: 1 },
  ];

  const addOnRecords: Record<string, { id: string; name: string; priceInr: number; frequency: BillingFrequency; minQuantity: number; maxQuantity: number }> = {};
  for (const a of addOns) {
    const record = await prisma.addOn.upsert({
      where: { id: `addon_${a.name.toLowerCase().replace(/\s+/g, "_")}` },
      update: a,
      create: { id: `addon_${a.name.toLowerCase().replace(/\s+/g, "_")}`, ...a },
    });
    addOnRecords[record.id] = record;
  }
  console.log(`Seeded ${addOns.length} add-ons.`);

  // Plans
  const plans = [
    {
      id: "plan_free",
      name: "Free",
      description: "For individuals exploring the platform.",
      monthlyPriceInr: 0,
      annualPriceInr: 0,
      currency: "INR",
      trialDays: 0,
      isActive: true,
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
      id: "plan_starter",
      name: "Starter",
      description: "For small local businesses getting started.",
      monthlyPriceInr: 499,
      annualPriceInr: 4990,
      currency: "INR",
      trialDays: 14,
      isActive: true,
      limits: [
        { serviceKey: "conversations", includedQuantity: 500, overagePriceInr: 1.5 },
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
      addOns: ["addon_extra_whatsapp_pack", "addon_extra_team_seats"],
    },
    {
      id: "plan_growth",
      name: "Growth",
      description: "For growing businesses that need more power.",
      monthlyPriceInr: 1499,
      annualPriceInr: 14990,
      currency: "INR",
      trialDays: 14,
      isActive: true,
      limits: [
        { serviceKey: "conversations", includedQuantity: 2000, overagePriceInr: 1 },
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
      addOns: ["addon_extra_whatsapp_pack", "addon_extra_team_seats", "addon_priority_support"],
    },
    {
      id: "plan_business",
      name: "Business",
      description: "For multi-location teams and franchises.",
      monthlyPriceInr: 3999,
      annualPriceInr: 39990,
      currency: "INR",
      trialDays: 14,
      isActive: true,
      limits: [
        { serviceKey: "conversations", includedQuantity: 10000, overagePriceInr: 0.75 },
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
      addOns: ["addon_extra_whatsapp_pack", "addon_extra_team_seats", "addon_priority_support"],
    },
    {
      id: "plan_enterprise",
      name: "Enterprise",
      description: "Custom pricing for large-scale deployments.",
      monthlyPriceInr: 0,
      annualPriceInr: 0,
      currency: "INR",
      trialDays: 0,
      isActive: true,
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
      where: { id: p.id },
      update: {
        name: p.name,
        description: p.description,
        monthlyPriceInr: p.monthlyPriceInr,
        annualPriceInr: p.annualPriceInr,
        currency: p.currency,
        trialDays: p.trialDays,
        isActive: p.isActive,
      },
      create: {
        id: p.id,
        name: p.name,
        description: p.description,
        monthlyPriceInr: p.monthlyPriceInr,
        annualPriceInr: p.annualPriceInr,
        currency: p.currency,
        trialDays: p.trialDays,
        isActive: p.isActive,
      },
    });

    // Recreate limits
    await prisma.planLimit.deleteMany({ where: { planId: p.id } });
    await prisma.planLimit.createMany({
      data: p.limits.map((l) => ({
        planId: p.id,
        serviceId: serviceMap[l.serviceKey].id,
        includedQuantity: l.includedQuantity,
        overagePriceInr: l.overagePriceInr ?? null,
      })),
    });

    // Recreate features
    await prisma.planFeature.deleteMany({ where: { planId: p.id } });
    await prisma.planFeature.createMany({
      data: p.features.map((f) => ({
        planId: p.id,
        key: f.key,
        label: f.label,
        value: null,
        included: f.included ?? true,
      })),
    });

    // Recreate plan add-ons
    await prisma.planAddOn.deleteMany({ where: { planId: p.id } });
    if (p.addOns.length > 0) {
      await prisma.planAddOn.createMany({
        data: p.addOns.map((addOnId) => ({ planId: p.id, addOnId })),
      });
    }
  }
  console.log(`Seeded ${plans.length} subscription plans.`);

  // Default tax config
  await prisma.taxConfiguration.upsert({
    where: { id: "default_tax" },
    update: {},
    create: { id: "default_tax", name: "GST", rate: 18, inclusive: false, enabled: true },
  });
  console.log("Seeded default GST tax configuration.");
}

// Only run directly when executed as a standalone script.
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
