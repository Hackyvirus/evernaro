import "dotenv/config";
import bcrypt from "bcryptjs";
import {
  PrismaClient,
  ChannelType,
  UserRole,
  ConversationStatus,
  ConversationPriority,
  MessageDirection,
  MessageSender,
  AppointmentStatus,
  QueueEntryStatus,
  CampaignStatus,
  RecipientStatus,
  ReminderStatus,
  ReminderType,
  JobCardStatus,
  MembershipStatus,
  CustomerEventType,
  InvoiceStatus,
  InvoiceType,
  AutomationTrigger,
  AutomationActionType,
  SubscriptionStatus,
  BillingFrequency,
  ResourceType,
  type IndustryCode,
} from "@prisma/client";
import { INDUSTRY_TEMPLATES, type IndustryTemplate, getIndustryTemplate } from "../src/lib/industry-templates";

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL },
  },
});

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "DemoPass1234";
const DEMO_PLATFORM_ADMIN_EMAIL = process.env.DEMO_PLATFORM_ADMIN_EMAIL || "admin-demo@evernaro.com";
const DEMO_PLATFORM_ADMIN_PASSWORD = process.env.DEMO_PLATFORM_ADMIN_PASSWORD || "DemoAdmin1234";

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

function daysFromNow(d: number) {
  return new Date(Date.now() + d * 24 * 60 * 60 * 1000);
}

function codeToBase(code: IndustryCode) {
  return code.toLowerCase().replace(/_/g, "-");
}

async function seedIndustryTemplates() {
  for (const template of INDUSTRY_TEMPLATES) {
    await prisma.industryTemplate.upsert({
      where: { code: template.code },
      update: {
        name: template.name,
        description: template.description,
        config: template.config as never,
      },
      create: {
        code: template.code,
        name: template.name,
        description: template.description,
        config: template.config as never,
      },
    });
  }
  console.log(`Seeded ${INDUSTRY_TEMPLATES.length} industry templates.`);
}

async function seedDemoOrg(template: IndustryTemplate) {
  const base = codeToBase(template.code);
  const slug = `demo-${base}`;
  const ownerEmail = `demo-${base}@evernaro.com`;
  const config = template.config;
  const terminology = config.terminology;
  const features = config.features;

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const existingOrg = await prisma.organization.findUnique({ where: { slug } });
  if (existingOrg) {
    await prisma.organization.delete({ where: { id: existingOrg.id } });
    console.log(`  Refreshed demo org: ${slug}`);
  }

  const org = await prisma.organization.create({
    data: {
      name: `${template.name} Demo`,
      slug,
      monthlyFeeInr: 3999,
      status: "ACTIVE",
      industryTemplateId: (
        await prisma.industryTemplate.findUniqueOrThrow({ where: { code: template.code } })
      ).id,
    },
  });

  await prisma.organizationIndustryConfig.create({
    data: {
      orgId: org.id,
      templateId: org.industryTemplateId!,
      config: {},
    },
  });

  await prisma.businessProfile.create({
    data: {
      orgId: org.id,
      businessName: `${template.name} Demo`,
      industry: template.name,
      description: `A demo ${template.name.toLowerCase()} organization for testing every Evernaro feature.`,
      address: "123 MG Road, Bangalore, India",
      phone: "+91-98765-43210",
      website: `https://${base}.demo.evernaro.com`,
      workingHours: "Mon-Sun 10:00 AM - 8:00 PM",
      tone: "friendly and professional",
      formality: "semi-formal",
      language: "en",
      knowledgeBase: template.description,
      faqs: [{ question: "What are your timings?", answer: "We are open 10 AM to 8 PM, seven days a week." }] as never,
      products: [] as never,
      policies: [{ title: "Cancellation", body: "Please cancel or reschedule at least 2 hours in advance." }] as never,
    },
  });

  await prisma.whatsAppWallet.create({
    data: {
      orgId: org.id,
      balancePaise: 100000,
      lowBalanceThresholdPaise: 10000,
    },
  });

  const plan = await prisma.subscriptionPlan.findUnique({ where: { slug: "growth" } });
  if (plan) {
    await prisma.customerSubscription.create({
      data: {
        orgId: org.id,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        frequency: BillingFrequency.MONTHLY,
        currentPeriodStart: new Date(),
        currentPeriodEnd: daysFromNow(30),
        quantity: 1,
        baseAmountInr: plan.monthlyPriceInr,
        totalAmountInr: plan.monthlyPriceInr,
      },
    });
  }

  const owner = await prisma.user.create({
    data: {
      email: ownerEmail.toLowerCase(),
      name: "Demo Owner",
      passwordHash,
      role: UserRole.OWNER,
      orgId: org.id,
      emailVerified: true,
    },
  });

  const channels = await Promise.all([
    prisma.channel.create({
      data: { orgId: org.id, type: ChannelType.WHATSAPP, whatsappApiKey: "demo", whatsappAppName: "demo", whatsappAppId: "demo", whatsappSourceNumber: "919876543210", isActive: true },
    }),
    prisma.channel.create({
      data: { orgId: org.id, type: ChannelType.TELEGRAM, telegramBotToken: "demo", telegramBotUsername: "demo_bot", isActive: true },
    }),
    prisma.channel.create({
      data: { orgId: org.id, type: ChannelType.EMAIL, emailAddress: ownerEmail, emailFromName: `${template.name} Demo`, resendApiKey: "demo", isActive: true },
    }),
  ]);

  // Services from template defaults; fallback to a generic service so appointments can reference something.
  const serviceInputs = config.defaultServices.length
    ? config.defaultServices
    : [{ name: `${terminology.appointment || "Service"}`, durationMin: 60, priceInr: 0 }];

  const services = await Promise.all(
    serviceInputs.map((s, i) =>
      prisma.service.create({
        data: {
          orgId: org.id,
          name: s.name,
          durationMin: s.durationMin ?? 60,
          priceInr: s.priceInr ?? 0,
          color: ["#F59E0B", "#8B5CF6", "#10B981", "#EC4899", "#3B82F6"][i % 5],
        },
      })
    )
  );

  // Staff
  const staffCount = 3;
  const staffProfiles = await Promise.all(
    Array.from({ length: staffCount }).map((_, i) =>
      prisma.staffProfile.create({
        data: {
          orgId: org.id,
          name: ["Aisha", "Priya", "Neha", "Rahul", "Sneha"][i % 5],
          role: terminology.staff || "Staff",
          phone: `+91-90001-0000${i + 1}`,
          color: ["#F59E0B", "#8B5CF6", "#10B981", "#EC4899", "#3B82F6"][i % 5],
          isActive: true,
        },
      })
    )
  );

  if (services.length) {
    await prisma.serviceStaff.createMany({
      data: services.flatMap((svc, i) =>
        staffProfiles.slice(0, 2).map((staff) => ({
          serviceId: svc.id,
          staffId: staffProfiles[(i + staffProfiles.indexOf(staff)) % staffProfiles.length].id,
        }))
      ),
    });
  }

  // Resources for restaurant / auto service
  if (features.resources || features.tables) {
    const resourceType: ResourceType = features.tables
      ? ResourceType.TABLE
      : template.code === "AUTO_SERVICE"
      ? ResourceType.BAY
      : ResourceType.ROOM;
    const resourceName = features.tables ? "Table" : resourceType === ResourceType.BAY ? "Service Bay" : "Room";
    await Promise.all(
      Array.from({ length: 3 }).map((_, i) =>
        prisma.resource.create({
          data: {
            orgId: org.id,
            name: `${resourceName} ${i + 1}`,
            type: resourceType,
            capacity: resourceType === ResourceType.TABLE ? 4 : 1,
            isActive: true,
          },
        })
      )
    );
  }

  // Contacts
  const contacts: { id: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const contact = await prisma.contact.create({
      data: {
        orgId: org.id,
        name: [`Rahul Sharma`, `Sneha Gupta`, `Amit Verma`, `Priya Nair`, `Vikram Rao`, `Ananya Iyer`][i],
        phone: `919800000${(i + 1).toString().padStart(2, "0")}`,
        email: `customer${i + 1}-${base}@example.com`,
        tags: i % 2 === 0 ? ["VIP", "Repeat"] : ["New"],
        notes: `Demo ${terminology.customer || "customer"} #${i + 1}`,
      },
    });
    contacts.push(contact);
  }

  // Conversations + messages
  for (let i = 0; i < 3; i++) {
    const conv = await prisma.conversation.create({
      data: {
        orgId: org.id,
        contactId: contacts[i].id,
        channelId: channels[0].id,
        status: i === 0 ? ConversationStatus.OPEN : ConversationStatus.CLOSED,
        priority: i === 0 ? ConversationPriority.HIGH : ConversationPriority.MEDIUM,
        assignedToId: i === 0 ? owner.id : null,
        lastMessageAt: hoursAgo(i * 2),
      },
    });
    await prisma.message.createMany({
      data: [
        {
          conversationId: conv.id,
          direction: MessageDirection.INBOUND,
          sender: MessageSender.CONTACT,
          body: `Hi, I need help with a ${terminology.appointment || "booking"}.`,
          createdAt: hoursAgo(i * 2 + 1),
        },
        {
          conversationId: conv.id,
          direction: MessageDirection.OUTBOUND,
          sender: MessageSender.AGENT,
          body: "Sure! What time works for you?",
          createdAt: hoursAgo(i * 2 + 0.8),
        },
      ],
    });
  }

  // Appointments
  const now = new Date();
  for (let i = 0; i < 3; i++) {
    const svc = services[i % services.length];
    const staff = staffProfiles[i % staffProfiles.length];
    const startsAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (i - 1), 10 + i * 2, 0);
    await prisma.appointment.create({
      data: {
        orgId: org.id,
        contactId: contacts[i].id,
        serviceId: svc?.id || null,
        staffId: staff.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + (svc?.durationMin || 60) * 60000),
        status: [AppointmentStatus.BOOKED, AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED][i % 3],
        notes: `Demo ${terminology.appointment || "appointment"}`,
      },
    });
  }

  // Queue
  if (features.queue) {
    const queue = await prisma.queue.create({ data: { orgId: org.id, name: `${terminology.queue || "Queue"} Demo`, isActive: true } });
    for (let i = 0; i < 3; i++) {
      await prisma.queueEntry.create({
        data: {
          orgId: org.id,
          queueId: queue.id,
          contactId: contacts[i + 3].id,
          serviceId: services[i % services.length]?.id || null,
          staffId: staffProfiles[i % staffProfiles.length].id,
          token: `T${i + 1}`,
          position: i,
          status: [QueueEntryStatus.WAITING, QueueEntryStatus.CALLED, QueueEntryStatus.IN_PROGRESS][i % 3],
          estimatedWaitMin: (i + 1) * 10,
        },
      });
    }
  }

  // Campaigns
  const draftCampaign = await prisma.campaign.create({
    data: {
      orgId: org.id,
      channelId: channels[0].id,
      name: "Demo Broadcast",
      description: "Test campaign in draft",
      messageTemplate: `Hi {{name}}, check out our latest ${template.name.toLowerCase()} offers!`,
      status: CampaignStatus.DRAFT,
      timezone: "Asia/Kolkata",
      totalRecipients: 2,
    },
  });
  const completedCampaign = await prisma.campaign.create({
    data: {
      orgId: org.id,
      channelId: channels[0].id,
      name: "Demo Completed Campaign",
      description: "Already sent",
      messageTemplate: "Hi {{name}}, thanks for being with us!",
      status: CampaignStatus.COMPLETED,
      timezone: "Asia/Kolkata",
      totalRecipients: 2,
      sentCount: 2,
    },
  });
  await prisma.campaignRecipient.createMany({
    data: [
      { campaignId: draftCampaign.id, contactId: contacts[0].id, status: RecipientStatus.PENDING },
      { campaignId: draftCampaign.id, contactId: contacts[1].id, status: RecipientStatus.PENDING },
      { campaignId: completedCampaign.id, contactId: contacts[2].id, status: RecipientStatus.SENT, sentAt: hoursAgo(24) },
      { campaignId: completedCampaign.id, contactId: contacts[3].id, status: RecipientStatus.SENT, sentAt: hoursAgo(24) },
    ],
  });

  // Reminders
  await prisma.reminder.createMany({
    data: [
      {
        orgId: org.id,
        contactId: contacts[0].id,
        channelId: channels[0].id,
        title: `Upcoming ${terminology.appointment || "appointment"}`,
        type: ReminderType.APPOINTMENT,
        message: `Hi, this is a reminder for your upcoming ${terminology.appointment || "appointment"}.`,
        assignedToId: owner.id,
        scheduledFor: daysFromNow(1),
        status: ReminderStatus.PENDING,
      },
      {
        orgId: org.id,
        contactId: contacts[1].id,
        channelId: channels[0].id,
        title: "Follow-up",
        type: ReminderType.FOLLOW_UP,
        message: "Just checking in — how did it go?",
        assignedToId: owner.id,
        scheduledFor: hoursAgo(2),
        status: ReminderStatus.SENT,
      },
    ],
  });

  // Job cards
  if (features.jobCards) {
    await prisma.jobCard.createMany({
      data: [
        {
          orgId: org.id,
          contactId: contacts[2].id,
          serviceId: services[0]?.id || null,
          staffId: staffProfiles[0].id,
          title: `Demo ${terminology.job || "job"} 1`,
          description: "In progress demo work.",
          status: JobCardStatus.IN_PROGRESS,
          estimateInr: 2500,
        },
        {
          orgId: org.id,
          contactId: contacts[3].id,
          serviceId: services[1]?.id || null,
          staffId: staffProfiles[1].id,
          title: `Demo ${terminology.job || "job"} 2`,
          description: "Completed demo work.",
          status: JobCardStatus.DELIVERED,
          estimateInr: 600,
        },
      ],
    });
  }

  // Memberships
  if (features.memberships) {
    await prisma.membership.createMany({
      data: [
        {
          orgId: org.id,
          contactId: contacts[4].id,
          name: "Gold Membership",
          sessionsTotal: 12,
          sessionsUsed: 3,
          expiresAt: daysFromNow(90),
          status: MembershipStatus.ACTIVE,
        },
        {
          orgId: org.id,
          contactId: contacts[5].id,
          name: "Silver Membership",
          sessionsTotal: 6,
          sessionsUsed: 5,
          expiresAt: daysFromNow(10),
          status: MembershipStatus.EXPIRED,
        },
      ],
    });
  }

  // Reviews
  if (features.reviews) {
    await prisma.review.createMany({
      data: [
        { orgId: org.id, contactId: contacts[0].id, rating: 5, comment: "Great service!" },
        { orgId: org.id, contactId: contacts[1].id, rating: 4, comment: "Good experience overall." },
      ],
    });
  }

  // Invoices
  await prisma.invoice.createMany({
    data: [
      { orgId: org.id, type: InvoiceType.SUBSCRIPTION, amountInr: org.monthlyFeeInr || 3999, status: InvoiceStatus.PAID, paidAt: hoursAgo(48) },
      { orgId: org.id, type: InvoiceType.SUBSCRIPTION, amountInr: org.monthlyFeeInr || 3999, status: InvoiceStatus.PENDING },
    ],
  });

  // Customer events
  await prisma.customerEvent.createMany({
    data: [
      { orgId: org.id, contactId: contacts[0].id, type: CustomerEventType.APPOINTMENT_BOOKED, entityType: "appointment" },
      { orgId: org.id, contactId: contacts[1].id, type: CustomerEventType.SERVICE_COMPLETED, entityType: "appointment" },
      { orgId: org.id, contactId: contacts[2].id, type: CustomerEventType.PAYMENT_RECEIVED, entityType: "invoice" },
    ],
  });

  // Automations
  await prisma.automation.createMany({
    data: [
      {
        orgId: org.id,
        name: "Appointment reminder",
        trigger: AutomationTrigger.APPOINTMENT_DUE_SOON,
        conditions: [] as never,
        actions: [{ type: AutomationActionType.SEND_MESSAGE, config: { template: "appointment_reminder" } }] as never,
        isActive: true,
      },
      {
        orgId: org.id,
        name: "Request review",
        trigger: AutomationTrigger.SERVICE_COMPLETED,
        conditions: [] as never,
        actions: [{ type: AutomationActionType.REQUEST_REVIEW, config: { delayHours: 2 } }] as never,
        isActive: true,
      },
    ],
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      orgId: org.id,
      userId: owner.id,
      action: "ORG_CREATED",
      targetType: "Organization",
      targetId: org.id,
      metadata: { note: `Demo ${template.name} org seeded` } as never,
    },
  });

  console.log(`  ✅ ${template.name}: owner=${owner.email}`);
}

async function main() {
  console.log("Starting multi-industry demo account seed...");

  await seedIndustryTemplates();

  // Platform admin (single, shared across all demos)
  const platformAdminPasswordHash = await bcrypt.hash(DEMO_PLATFORM_ADMIN_PASSWORD, 12);
  const platformAdmin = await prisma.platformAdmin.upsert({
    where: { email: DEMO_PLATFORM_ADMIN_EMAIL.toLowerCase() },
    update: { passwordHash: platformAdminPasswordHash },
    create: {
      email: DEMO_PLATFORM_ADMIN_EMAIL.toLowerCase(),
      name: "Demo Platform Admin",
      passwordHash: platformAdminPasswordHash,
    },
  });
  console.log("Demo platform admin:", platformAdmin.email);

  // Clean up any previous demo orgs
  const existingDemoOrgs = await prisma.organization.findMany({
    where: { slug: { startsWith: "demo-" } },
    select: { id: true, slug: true },
  });
  for (const o of existingDemoOrgs) {
    await prisma.organization.delete({ where: { id: o.id } });
    console.log(`Deleted previous demo org: ${o.slug}`);
  }

  for (const template of INDUSTRY_TEMPLATES) {
    await seedDemoOrg(getIndustryTemplate(template.code)!);
  }

  console.log("\nAll demo orgs seeded.");
  console.log(`Platform admin login: ${platformAdmin.email} / ${DEMO_PLATFORM_ADMIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
