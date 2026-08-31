/**
 * One-off launch cleanup. Dry-run by default; pass --apply to write.
 *   npx tsx scripts/launch-cleanup.ts
 *   npx tsx scripts/launch-cleanup.ts --apply
 *
 * 1. Create a local row for the `queue_checkedin` WhatsApp template (it exists
 *    on Gupshup as IN_APPEAL but has no DB row, so it's invisible in-app and
 *    can never be synced). Created as PENDING; sync-wa-templates.ts will flip
 *    it to APPROVED automatically once the appeal clears.
 * 2. Delete the stale test appointment whose reminders (if any) predate the
 *    template sync.
 * 3. Delete empty throwaway test organizations.
 */
import { prisma } from "../src/lib/prisma";

const APPLY = process.argv.includes("--apply");

const QUEUE_CHECKEDIN = {
  channelId: "cmt8e41gr0001l6044vnglpr8",
  name: "queue_checkedin",
  category: "UTILITY" as const,
  language: "en",
  bodyText:
    "Hi {{1}}, you've successfully checked in at {{2}}. Your token number is {{3}} and estimated wait time is {{4}} minutes. Thank you for your patience.",
  gupshupTemplateId: "d3665bad-5b0e-4d1e-90e4-577c651cd04c",
};

const DELETE_APPOINTMENT_IDS = ["cmt85f2rp0007l104n5lb1rw7"];
const DELETE_ORG_SLUGS = ["test-refwin-1786894776", "test-refwin-1786896051"];

async function main() {
  // 1. queue_checkedin local row
  const existing = await prisma.whatsAppTemplate.findUnique({
    where: { channelId_name: { channelId: QUEUE_CHECKEDIN.channelId, name: QUEUE_CHECKEDIN.name } },
  });
  if (existing) {
    console.log(`[1] queue_checkedin row already exists (status=${existing.status}) — nothing to do`);
  } else {
    console.log(`[1] CREATE queue_checkedin row (status=PENDING, gupshupId=${QUEUE_CHECKEDIN.gupshupTemplateId})`);
    if (APPLY) {
      await prisma.whatsAppTemplate.create({ data: { ...QUEUE_CHECKEDIN, status: "PENDING" } });
    }
  }

  // 2. stale test appointment(s)
  for (const id of DELETE_APPOINTMENT_IDS) {
    const appt = await prisma.appointment.findUnique({
      where: { id },
      include: { contact: { select: { name: true, phone: true } } },
    });
    if (!appt) {
      console.log(`[2] appointment ${id} not found — skip`);
      continue;
    }
    const reminders = await prisma.reminder.count({ where: { contactId: appt.contactId, type: "APPOINTMENT" } });
    console.log(
      `[2] DELETE appointment ${id}  ${appt.startsAt.toISOString()}  ${appt.status}  ` +
        `contact=${appt.contact?.name}/${appt.contact?.phone}  (${reminders} appointment reminder(s) for this contact will also be removed)`,
    );
    if (APPLY) {
      await prisma.reminder.deleteMany({ where: { contactId: appt.contactId, type: "APPOINTMENT" } });
      await prisma.appointment.delete({ where: { id } });
    }
  }

  // 3. empty test orgs
  for (const slug of DELETE_ORG_SLUGS) {
    const org = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true, name: true, _count: { select: { users: true, contacts: true, appointments: true, channels: true } } },
    });
    if (!org) {
      console.log(`[3] org ${slug} not found — skip`);
      continue;
    }
    const c = org._count;
    console.log(
      `[3] DELETE org ${slug} "${org.name}"  users=${c.users} contacts=${c.contacts} appts=${c.appointments} channels=${c.channels}`,
    );
    if (c.users + c.contacts + c.appointments + c.channels > 0) {
      console.log(`     -> NOT empty, refusing to delete. Remove it manually if intended.`);
      continue;
    }
    if (APPLY) {
      await prisma.organization.delete({ where: { id: org.id } });
    }
  }

  console.log(APPLY ? "\nApplied." : "\nDry run — re-run with --apply to write.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
