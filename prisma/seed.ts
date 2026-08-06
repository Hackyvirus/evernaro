import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Use the direct (non-pooled) database URL when available so the seed can run
// while the dev server is holding pooled connections.
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.log("Seeding skipped in production.");
    return;
  }

  const clientPassword = await bcrypt.hash("DemoClient1234", 12);
  const adminPassword = await bcrypt.hash("DemoAdmin1234", 12);

  const org = await prisma.organization.upsert({
    where: { slug: "demo-co" },
    update: {},
    create: {
      name: "Demo Co",
      slug: "demo-co",
      monthlyFeeInr: 3999,
      status: "ACTIVE",
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
      businessName: "Demo Co",
      industry: "Services",
      description: "A demo business for testing Evernaro.",
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
