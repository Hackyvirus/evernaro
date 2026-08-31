/** Read-only readiness probe: worker/queue health + core data state.
 * npx tsx -r dotenv/config scripts/readiness-audit.ts dotenv_config_path=.env */
import { prisma } from "../src/lib/prisma";
import { redisConnection } from "../src/lib/redis";

async function main() {
  console.log("################ BULLMQ / WORKER ################");
  const queues = ["campaign-send", "reminder-send", "queue-no-show", "billing-run"];
  for (const q of queues) {
    const keys = await redisConnection.keys(`bull:${q}:*`);
    const wait = await redisConnection.llen(`bull:${q}:wait`).catch(() => -1);
    const active = await redisConnection.llen(`bull:${q}:active`).catch(() => -1);
    const completed = await redisConnection.zcard(`bull:${q}:completed`).catch(() => -1);
    const failed = await redisConnection.zcard(`bull:${q}:failed`).catch(() => -1);
    const delayed = await redisConnection.zcard(`bull:${q}:delayed`).catch(() => -1);
    console.log(`${q}: keys=${keys.length} wait=${wait} active=${active} delayed=${delayed} completed=${completed} failed=${failed}`);
  }

  console.log("\n################ ORG / CHANNELS ################");
  const orgs = await prisma.organization.findMany({
    select: {
      slug: true, name: true, status: true, timezone: true,
      channels: { select: { type: true, isActive: true, whatsappSourceNumber: true, whatsappAppId: true } },
      _count: { select: { services: true, staffProfiles: true, contacts: true, appointments: true, reminders: true, campaigns: true, conversations: true } },
    },
  });
  for (const o of orgs) {
    console.log(`\n${o.slug} "${o.name}" status=${o.status} tz=${o.timezone}`);
    console.log(`  counts: services=${o._count.services} staff=${o._count.staffProfiles} contacts=${o._count.contacts} appts=${o._count.appointments} reminders=${o._count.reminders} campaigns=${o._count.campaigns} convos=${o._count.conversations}`);
    for (const c of o.channels) {
      console.log(`  channel ${c.type} active=${c.isActive} waSource=${c.whatsappSourceNumber ?? "-"} waAppId=${c.whatsappAppId ? "set" : "-"}`);
    }
  }

  console.log("\n################ REMINDERS ################");
  const rem = await prisma.reminder.groupBy({ by: ["status"], _count: true });
  console.log(rem.map((r) => `${r.status}=${r._count}`).join("  ") || "none");
  const upcoming = await prisma.reminder.findMany({
    where: { status: "PENDING" }, orderBy: { scheduledFor: "asc" }, take: 5,
    select: { scheduledFor: true, channelId: true, whatsappTemplateId: true, title: true },
  });
  for (const r of upcoming) console.log(`  PENDING ${r.scheduledFor.toISOString()} tmpl=${r.whatsappTemplateId ?? "PLAINTEXT"} "${r.title}"`);

  console.log("\n################ CONVERSATIONS / MESSAGES ################");
  const msgCount = await prisma.message.count();
  const convCount = await prisma.conversation.count();
  const lastMsg = await prisma.message.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true, direction: true } });
  console.log(`conversations=${convCount} messages=${msgCount} lastMessage=${lastMsg ? lastMsg.createdAt.toISOString() + " " + lastMsg.direction : "none"}`);

  console.log("\n################ BILLING ################");
  const subs = await prisma.customerSubscription.findMany({
    select: { status: true, plan: { select: { slug: true } }, razorpaySubscriptionId: true, trialEnd: true, org: { select: { slug: true } } },
  });
  for (const s of subs) console.log(`  ${s.org.slug}: ${s.plan.slug} ${s.status} rzpSub=${s.razorpaySubscriptionId ?? "-"} trialEnd=${s.trialEnd?.toISOString().slice(0, 10) ?? "-"}`);
  const inv = await prisma.invoice.groupBy({ by: ["status", "type"], _count: true });
  for (const i of inv) console.log(`  invoice ${i.type}/${i.status} = ${i._count}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
