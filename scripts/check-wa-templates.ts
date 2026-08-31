/**
 * Read-only: list every WhatsApp template row, its local status, and whether
 * it was ever submitted to Gupshup. Run: npx tsx scripts/check-wa-templates.ts
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const templates = await prisma.whatsAppTemplate.findMany({
    include: { channel: { include: { org: { select: { name: true, slug: true } } } } },
    orderBy: [{ channelId: "asc" }, { name: "asc" }],
  });

  if (templates.length === 0) {
    console.log("No WhatsApp templates in the database.");
    return;
  }

  for (const t of templates) {
    console.log(
      [
        `org=${t.channel.org.slug}`,
        `channel=${t.channelId}`,
        `name=${t.name}`,
        `localStatus=${t.status}`,
        `gupshupId=${t.gupshupTemplateId ?? "NONE"}`,
        t.rejectionReason ? `reason="${t.rejectionReason}"` : "",
      ]
        .filter(Boolean)
        .join("  "),
    );
  }
  console.log(`\n${templates.length} template row(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
