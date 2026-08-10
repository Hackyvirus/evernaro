// One-off script to reset the platform admin password.
// Run with: node scripts/reset-platform-admin.mjs
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const newPassword = process.env.NEW_ADMIN_PASSWORD;
if (!newPassword || newPassword.length < 8) {
  console.error("Set NEW_ADMIN_PASSWORD env var to a value with at least 8 characters.");
  process.exit(1);
}

async function main() {
  const admin = await prisma.platformAdmin.findFirst();
  if (!admin) {
    console.error("No platform admin exists. Visit /platform/setup instead.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.platformAdmin.update({
    where: { id: admin.id },
    data: { passwordHash, tokenVersion: { increment: 1 } },
  });

  console.log(`Platform admin password reset for: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
