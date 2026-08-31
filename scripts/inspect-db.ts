/** Read-only snapshot for launch cleanup decisions. */
import { prisma } from "../src/lib/prisma";

async function main() {
  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      _count: { select: { users: true, contacts: true, appointments: true, channels: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  console.log("=== ORGANIZATIONS ===");
  for (const o of orgs) {
    console.log(
      `${o.slug}  "${o.name}"  created=${o.createdAt.toISOString().slice(0, 10)}  ` +
        `users=${o._count.users} contacts=${o._count.contacts} appts=${o._count.appointments} channels=${o._count.channels}`,
    );
  }

  const admins = await prisma.platformAdmin.findMany({
    select: { id: true, email: true, name: true, createdAt: true },
  });
  console.log("\n=== PLATFORM ADMINS ===");
  for (const a of admins) console.log(`${a.email}  "${a.name}"  created=${a.createdAt.toISOString().slice(0, 10)}`);

  console.log("\n=== APPOINTMENTS + their reminders (non-demo orgs) ===");
  const appts = await prisma.appointment.findMany({
    where: { org: { slug: { not: { startsWith: "demo-" } } } },
    select: {
      id: true,
      startsAt: true,
      status: true,
      org: { select: { slug: true } },
      contact: { select: { name: true, phone: true } },
    },
    orderBy: { startsAt: "asc" },
  });
  for (const a of appts) {
    console.log(
      `${a.org.slug}  appt=${a.id}  ${a.startsAt.toISOString()}  ${a.status}  contact=${a.contact?.name ?? "?"}/${a.contact?.phone ?? "?"}`,
    );
  }

  console.log("\n=== REMINDERS (non-demo, APPOINTMENT type) ===");
  const reminders = await prisma.reminder.findMany({
    where: { org: { slug: { not: { startsWith: "demo-" } } }, type: "APPOINTMENT" },
    select: {
      id: true,
      title: true,
      status: true,
      scheduledFor: true,
      whatsappTemplateId: true,
      templateParams: true,
      org: { select: { slug: true } },
    },
    orderBy: { scheduledFor: "asc" },
  });
  for (const r of reminders) {
    console.log(
      `${r.org.slug}  rem=${r.id}  ${r.scheduledFor.toISOString()}  ${r.status}  ` +
        `tmpl=${r.whatsappTemplateId ?? "NONE(plain text)"}  params=[${r.templateParams.join("|")}]  "${r.title}"`,
    );
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
