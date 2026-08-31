/** Read-only: dump the FULL template list from Gupshup for the Saloon channel,
 * including ones with no local row. npx tsx scripts/gupshup-list-templates.ts */
import { prisma } from "../src/lib/prisma";
import { decryptSecret } from "../src/lib/crypto";

async function main() {
  const channel = await prisma.channel.findFirst({
    where: { type: "WHATSAPP", whatsappApiKey: { not: null }, whatsappAppId: { not: null } },
  });
  if (!channel) return console.log("No configured WhatsApp channel.");

  const res = await fetch(`https://api.gupshup.io/wa/app/${channel.whatsappAppId}/template`, {
    headers: { apikey: decryptSecret(channel.whatsappApiKey!) },
  });
  const data = await res.json().catch(() => ({}));
  const templates: Array<Record<string, unknown>> = data?.templates ?? [];
  console.log(`channel=${channel.id}  ${templates.length} templates on Gupshup\n`);
  for (const t of templates) {
    console.log(
      `name=${t.elementName}  status=${t.status}  category=${t.category}  lang=${t.languageCode}  id=${t.id}`,
    );
    console.log(`  body: ${JSON.stringify(t.data ?? t.containerMeta ?? "")}\n`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
