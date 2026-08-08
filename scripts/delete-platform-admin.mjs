// One-off script to remove the platform admin so /platform/setup becomes available again.
// Run with: node scripts/delete-platform-admin.mjs --yes
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const confirmed = process.argv.includes("--yes");
if (!confirmed) {
  console.error("This will delete the PlatformAdmin row(s) and allow anyone with the setup token to recreate it.");
  console.error("Run again with --yes to confirm.");
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const { count } = await prisma.platformAdmin.deleteMany();
  console.log(`Deleted ${count} PlatformAdmin record(s). /platform/setup should now be reachable.`);
} catch (err) {
  console.error("Failed to delete PlatformAdmin:", err.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
