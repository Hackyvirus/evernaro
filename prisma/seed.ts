import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { INDUSTRY_TEMPLATES } from "../src/lib/industry-templates";
import { seedBillingCatalog } from "./billing-seed";

// Use the direct (non-pooled) database URL when available so the seed can run
// while the dev server is holding pooled connections.
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

async function seedIndustryTemplates() {
  for (const template of INDUSTRY_TEMPLATES) {
    await prisma.industryTemplate.upsert({
      where: { code: template.code },
      update: {
        name: template.name,
        description: template.description,
        config: template.config as never,
      },
      create: {
        code: template.code,
        name: template.name,
        description: template.description,
        config: template.config as never,
      },
    });
  }
  console.log(`Seeded ${INDUSTRY_TEMPLATES.length} industry templates.`);
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.log("Seeding skipped in production.");
    return;
  }

  await seedIndustryTemplates();
  await seedBillingCatalog();

  const salonTemplate = await prisma.industryTemplate.findUniqueOrThrow({
    where: { code: "SALON" },
  });

  const clientPassword = await bcrypt.hash("DemoClient1234", 12);
  const adminPassword = await bcrypt.hash("DemoAdmin1234", 12);

  const org = await prisma.organization.upsert({
    where: { slug: "demo-co" },
    update: {
      industryTemplateId: salonTemplate.id,
    },
    create: {
      name: "Demo Salon",
      slug: "demo-co",
      monthlyFeeInr: 3999,
      status: "ACTIVE",
      industryTemplateId: salonTemplate.id,
    },
  });

  await prisma.organizationIndustryConfig.upsert({
    where: { orgId: org.id },
    update: {},
    create: {
      orgId: org.id,
      templateId: salonTemplate.id,
      config: {},
    },
  });

  await prisma.user.upsert({
    where: { email: "client@demo.com" },
    update: { passwordHash: clientPassword },
    create: {
      email: "client@demo.com",
      name: "Demo Client",
      passwordHash: clientPassword,
      role: "OWNER",
      orgId: org.id,
      emailVerified: true,
    },
  });

  await prisma.businessProfile.upsert({
    where: { orgId: org.id },
    update: {},
    create: {
      orgId: org.id,
      businessName: "Demo Salon",
      industry: "Salon / Beauty",
      description: "A demo salon for testing Evernaro.",
    },
  });

  await prisma.whatsAppWallet.upsert({
    where: { orgId: org.id },
    update: {},
    create: {
      orgId: org.id,
      balancePaise: 100000, // ₹1,000 demo balance
      lowBalanceThresholdPaise: 10000,
    },
  });

  await prisma.platformAdmin.upsert({
    where: { email: "admin@demo.com" },
    update: { passwordHash: adminPassword },
    create: {
      email: "admin@demo.com",
      name: "Demo Admin",
      passwordHash: adminPassword,
    },
  });

  console.log("Demo accounts created/updated:");
  console.log("  Client dashboard: client@demo.com / DemoClient1234  (http://localhost:3000/login)");
  console.log("  Platform admin:   admin@demo.com / DemoAdmin1234    (http://localhost:3000/platform/login)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
