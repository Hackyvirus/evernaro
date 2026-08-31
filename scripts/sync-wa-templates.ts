/**
 * Sync every WhatsApp template's local status from Gupshup — same logic as
 * POST /api/whatsapp-templates/[id]/sync, run for all rows at once.
 *
 *   npx tsx scripts/sync-wa-templates.ts            # dry run, shows what would change
 *   npx tsx scripts/sync-wa-templates.ts --apply    # write the changes
 */
import { prisma } from "../src/lib/prisma";
import { decryptSecret } from "../src/lib/crypto";
import { gupshupGetTemplateStatus } from "../src/lib/whatsapp";

const APPLY = process.argv.includes("--apply");

function mapStatus(remote: string | undefined): "APPROVED" | "REJECTED" | "PENDING" {
  if (remote === "APPROVED") return "APPROVED";
  if (remote === "REJECTED") return "REJECTED";
  return "PENDING";
}

async function main() {
  const templates = await prisma.whatsAppTemplate.findMany({
    include: { channel: true },
    orderBy: { name: "asc" },
  });

  for (const t of templates) {
    if (!t.gupshupTemplateId || !t.channel.whatsappApiKey || !t.channel.whatsappAppId) {
      console.log(`SKIP  ${t.name}  (never submitted to Gupshup)`);
      continue;
    }

    let remote;
    try {
      remote = await gupshupGetTemplateStatus({
        apiKey: decryptSecret(t.channel.whatsappApiKey),
        appId: t.channel.whatsappAppId,
        gupshupTemplateId: t.gupshupTemplateId,
      });
    } catch (err) {
      console.log(`ERROR ${t.name}  ${err instanceof Error ? err.message : err}`);
      continue;
    }

    if (!remote) {
      console.log(`GONE  ${t.name}  (Gupshup no longer reports this template id)`);
      continue;
    }

    const next = mapStatus(remote.status);
    const changed = next !== t.status;
    console.log(
      `${changed ? "CHANGE" : "same  "} ${t.name}  ${t.status} -> ${next}` +
        (remote.reason ? `  reason="${remote.reason}"` : ""),
    );

    if (changed && APPLY) {
      await prisma.whatsAppTemplate.update({
        where: { id: t.id },
        // Drop any stale rejection/edit reason once Gupshup reports APPROVED.
        data: { status: next, rejectionReason: next === "APPROVED" ? null : remote.reason ?? null },
      });
    }
  }

  console.log(APPLY ? "\nApplied." : "\nDry run — re-run with --apply to write changes.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
