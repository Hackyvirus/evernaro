// One-off cleanup script to remove all demo organizations and the demo platform admin.
// Run with: node scripts/delete-demo-account.mjs --yes
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const confirmed = process.argv.includes("--yes");
if (!confirmed) {
  console.error("This will delete ALL organizations whose slug starts with 'demo-' and the demo platform admin.");
  console.error("Run again with --yes to confirm.");
  process.exit(1);
}

const DEMO_PLATFORM_ADMIN_EMAIL = process.env.DEMO_PLATFORM_ADMIN_EMAIL || "admin-demo@evernaro.com";

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL },
  },
});

try {
  const demoOrgs = await prisma.organization.findMany({
    where: { slug: { startsWith: "demo-" } },
    select: { id: true, slug: true },
  });

  for (const org of demoOrgs) {
    await prisma.organization.delete({ where: { id: org.id } });
    console.log(`Deleted demo organization: ${org.slug}`);
  }

  if (demoOrgs.length === 0) {
    console.log("No demo organizations found.");
  }

  const adminDelete = await prisma.platformAdmin.deleteMany({
    where: { email: DEMO_PLATFORM_ADMIN_EMAIL.toLowerCase() },
  });
  console.log(`Deleted ${adminDelete.count} demo platform admin record(s).`);
} catch (err) {
  console.error("Cleanup failed:", err.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
