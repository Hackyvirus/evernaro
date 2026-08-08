// One-off cleanup script to remove the demo organization and demo platform admin.
// Run with: node scripts/delete-demo-account.mjs --yes
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const confirmed = process.argv.includes("--yes");
if (!confirmed) {
  console.error("This will delete the demo organization (and all related data) plus the demo platform admin.");
  console.error("Run again with --yes to confirm.");
  process.exit(1);
}

const DEMO_ORG_SLUG = process.env.DEMO_ORG_SLUG || "demo-evernaro";
const DEMO_PLATFORM_ADMIN_EMAIL = process.env.DEMO_PLATFORM_ADMIN_EMAIL || "admin-demo@evernaro.com";

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL },
  },
});

try {
  const org = await prisma.organization.findUnique({ where: { slug: DEMO_ORG_SLUG } });
  if (org) {
    await prisma.organization.delete({ where: { id: org.id } });
    console.log(`Deleted demo organization: ${DEMO_ORG_SLUG}`);
  } else {
    console.log(`Demo organization not found: ${DEMO_ORG_SLUG}`);
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
