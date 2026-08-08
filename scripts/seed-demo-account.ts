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
} from "@prisma/client";
import { INDUSTRY_TEMPLATES } from "../src/lib/industry-templates";

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL },
  },
});

const DEMO_OWNER_EMAIL = process.env.DEMO_OWNER_EMAIL || "demo@evernaro.com";
const DEMO_ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL || "demo-admin@evernaro.com";
const DEMO_AGENT_EMAIL = process.env.DEMO_AGENT_EMAIL || "demo-agent@evernaro.com";
const DEMO_VIEWER_EMAIL = process.env.DEMO_VIEWER_EMAIL || "demo-viewer@evernaro.com";
const DEMO_PLATFORM_ADMIN_EMAIL = process.env.DEMO_PLATFORM_ADMIN_EMAIL || "admin-demo@evernaro.com";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "DemoPass1234";
const DEMO_PLATFORM_ADMIN_PASSWORD = process.env.DEMO_PLATFORM_ADMIN_PASSWORD || "DemoAdmin1234";
const DEMO_ORG_SLUG = process.env.DEMO_ORG_SLUG || "demo-evernaro";
const DEMO_INDUSTRY = process.env.DEMO_INDUSTRY || "SALON";

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

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

function daysFromNow(d: number) {
  return new Date(Date.now() + d * 24 * 60 * 60 * 1000);
}

async function main() {
  console.log("Starting demo account seed...");

  await seedIndustryTemplates();
  // Billing catalog (plans, add-ons, tax config) is assumed to already be seeded.
  // If it is missing, run: npx prisma db seed

  const template = await prisma.industryTemplate.findUnique({
    where: { code: DEMO_INDUSTRY },
  });
  if (!template) {
    throw new Error(`Industry template ${DEMO_INDUSTRY} not found`);
  }

  // Clean up any previous demo org
  const existingOrg = await prisma.organization.findUnique({
    where: { slug: DEMO_ORG_SLUG },
  });
  if (existingOrg) {
    await prisma.organization.delete({ where: { id: existingOrg.id } });
    console.log(`Deleted previous demo org: ${DEMO_ORG_SLUG}`);
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const platformAdminPasswordHash = await bcrypt.hash(DEMO_PLATFORM_ADMIN_PASSWORD, 12);

  const org = await prisma.organization.create({
    data: {
      name: "Demo Salon",
      slug: DEMO_ORG_SLUG,
      monthlyFeeInr: 3999,
      status: "ACTIVE",
      industryTemplateId: template.id,
    },
  });
  console.log(`Created org: ${org.name} (${org.slug})`);

  await prisma.organizationIndustryConfig.create({
    data: {
      orgId: org.id,
      templateId: template.id,
      config: {},
    },
  });

  await prisma.businessProfile.create({
    data: {
      orgId: org.id,
      businessName: "Demo Salon",
      industry: "Salon / Beauty",
      description: "A fully loaded demo salon for testing every Evernaro feature.",
      address: "123 MG Road, Bangalore, India",
      phone: "+91-98765-43210",
      website: "https://demo.evernaro.com",
      workingHours: "Mon-Sun 10:00 AM - 8:00 PM",
      tone: "friendly and professional",
      formality: "semi-formal",
      language: "en",
      knowledgeBase:
        "We offer haircuts, colouring, facials, manicures and pedicures. Walk-ins welcome. Prices start at ₹300.",
      faqs: [
        { question: "Do you take walk-ins?", answer: "Yes, but appointments are recommended." },
        { question: "What are your timings?", answer: "We are open 10 AM to 8 PM, seven days a week." },
      ] as never,
      products: [
        { name: "Haircut", price: "₹300", availability: "Available" },
        { name: "Hair Colour", price: "₹1,500", availability: "Available" },
      ] as never,
      policies: [
        { title: "Cancellation", body: "Please cancel or reschedule at least 2 hours in advance." },
      ] as never,
    },
  });

  await prisma.whatsAppWallet.create({
    data: {
      orgId: org.id,
      balancePaise: 100000,
      lowBalanceThresholdPaise: 10000,
    },
  });

  // Subscription for billing pages
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

  // Users
  const owner = await prisma.user.create({
    data: {
      email: DEMO_OWNER_EMAIL.toLowerCase(),
      name: "Demo Owner",
      passwordHash,
      role: UserRole.OWNER,
      orgId: org.id,
      emailVerified: true,
    },
  });
  const admin = await prisma.user.create({
    data: {
      email: DEMO_ADMIN_EMAIL.toLowerCase(),
      name: "Demo Admin",
      passwordHash,
      role: UserRole.ADMIN,
      orgId: org.id,
      emailVerified: true,
    },
  });
  const agent = await prisma.user.create({
    data: {
      email: DEMO_AGENT_EMAIL.toLowerCase(),
      name: "Demo Agent",
      passwordHash,
      role: UserRole.AGENT,
      orgId: org.id,
      emailVerified: true,
    },
  });
  const viewer = await prisma.user.create({
    data: {
      email: DEMO_VIEWER_EMAIL.toLowerCase(),
      name: "Demo Viewer",
      passwordHash,
      role: UserRole.VIEWER,
      orgId: org.id,
      emailVerified: true,
    },
  });
  console.log("Created demo users:", owner.email, admin.email, agent.email, viewer.email);

  // Platform admin
  const platformAdmin = await prisma.platformAdmin.upsert({
    where: { email: DEMO_PLATFORM_ADMIN_EMAIL.toLowerCase() },
    update: { passwordHash: platformAdminPasswordHash },
    create: {
      email: DEMO_PLATFORM_ADMIN_EMAIL.toLowerCase(),
      name: "Demo Platform Admin",
      passwordHash: platformAdminPasswordHash,
    },
  });
  console.log("Created demo platform admin:", platformAdmin.email);

  // Channels (dummy credentials — do not send real traffic)
  const whatsappChannel = await prisma.channel.create({
    data: {
      orgId: org.id,
      type: ChannelType.WHATSAPP,
      whatsappApiKey: "demo-api-key",
      whatsappAppName: "DemoApp",
      whatsappAppId: "demo-app-id",
      whatsappSourceNumber: "919876543210",
      isActive: true,
    },
  });
  const telegramChannel = await prisma.channel.create({
    data: {
      orgId: org.id,
      type: ChannelType.TELEGRAM,
      telegramBotToken: "demo-bot-token",
      telegramBotUsername: "demo_bot",
      isActive: true,
    },
  });
  const emailChannel = await prisma.channel.create({
    data: {
      orgId: org.id,
      type: ChannelType.EMAIL,
      emailAddress: "demo@evernaro.com",
      emailFromName: "Demo Salon",
      resendApiKey: "demo-resend-key",
      isActive: true,
    },
  });
  const instagramChannel = await prisma.channel.create({
    data: {
      orgId: org.id,
      type: ChannelType.INSTAGRAM,
      instagramPageAccessToken: "demo-ig-token",
      instagramPageId: "demo-page-id",
      instagramUsername: "demosalon",
      isActive: true,
    },
  });
  const voiceChannel = await prisma.channel.create({
    data: {
      orgId: org.id,
      type: ChannelType.VOICE,
      twilioAccountSid: "demo-twilio-sid",
      twilioAuthToken: "demo-twilio-token",
      twilioFromNumber: "+1234567890",
      isActive: true,
    },
  });
  console.log("Created demo channels");

  // Services
  const services = await Promise.all([
    prisma.service.create({
      data: { orgId: org.id, name: "Haircut", durationMin: 30, priceInr: 300, color: "#F59E0B" },
    }),
    prisma.service.create({
      data: { orgId: org.id, name: "Hair Color", durationMin: 90, priceInr: 1500, color: "#8B5CF6" },
    }),
    prisma.service.create({
      data: { orgId: org.id, name: "Facial", durationMin: 60, priceInr: 800, color: "#10B981" },
    }),
    prisma.service.create({
      data: { orgId: org.id, name: "Manicure", durationMin: 45, priceInr: 500, color: "#EC4899" },
    }),
    prisma.service.create({
      data: { orgId: org.id, name: "Pedicure", durationMin: 60, priceInr: 700, color: "#3B82F6" },
    }),
  ]);
  console.log("Created demo services");

  // Staff profiles
  const staffProfiles = await Promise.all([
    prisma.staffProfile.create({
      data: { orgId: org.id, name: "Aisha", role: "Senior Stylist", phone: "+91-90001-00001", color: "#F59E0B", isActive: true },
    }),
    prisma.staffProfile.create({
      data: { orgId: org.id, name: "Priya", role: "Colourist", phone: "+91-90001-00002", color: "#8B5CF6", isActive: true },
    }),
    prisma.staffProfile.create({
      data: { orgId: org.id, name: "Neha", role: "Beautician", phone: "+91-90001-00003", color: "#10B981", isActive: true },
    }),
  ]);
  // Link some staff to services
  await prisma.serviceStaff.createMany({
    data: [
      { serviceId: services[0].id, staffId: staffProfiles[0].id },
      { serviceId: services[1].id, staffId: staffProfiles[1].id },
      { serviceId: services[2].id, staffId: staffProfiles[2].id },
      { serviceId: services[3].id, staffId: staffProfiles[2].id },
      { serviceId: services[4].id, staffId: staffProfiles[2].id },
    ],
  });
  console.log("Created demo staff");

  // Contacts
  const contactData = [
    { name: "Rahul Sharma", phone: "919800000001", email: "rahul@example.com", tags: ["VIP", "Repeat"], notes: "Prefers morning slots." },
    { name: "Sneha Gupta", phone: "919800000002", email: "sneha@example.com", tags: ["New"], notes: "First visit last week." },
    { name: "Amit Verma", phone: "919800000003", email: "amit@example.com", tags: ["Repeat"], notes: "Allergic to certain dyes." },
    { name: "Priya Nair", phone: "919800000004", email: "priya.n@example.com", tags: ["VIP"], notes: "Takes facial + manicure combo." },
    { name: "Vikram Rao", phone: "919800000005", email: "vikram@example.com", tags: ["Campaign"], notes: "Came via Diwali campaign." },
    { name: "Ananya Iyer", phone: "919800000006", email: "ananya@example.com", tags: ["New"], notes: "Student, asks for discounts." },
    { name: "Karan Malhotra", phone: "919800000007", email: "karan@example.com", tags: ["Repeat", "VIP"], notes: "Regular haircut every 3 weeks." },
    { name: "Divya Joshi", phone: "919800000008", email: "divya@example.com", tags: ["Repeat"], notes: "Likes hair colour touch-ups." },
    { name: "Arjun Patil", phone: "919800000009", email: "arjun@example.com", tags: ["New"], notes: "Walk-in customer." },
    { name: "Meera Krishnan", phone: "919800000010", email: "meera@example.com", tags: ["Membership"], notes: "Gold membership holder." },
    { name: "Sanjay Mehta", phone: "919800000011", email: "sanjay@example.com", tags: ["Repeat"], notes: "Usually books weekends." },
    { name: "Riya Kapoor", phone: "919800000012", email: "riya@example.com", tags: ["Campaign"], notes: "Clicked WhatsApp campaign." },
  ];

  const contacts: any[] = [];
  for (const c of contactData) {
    const contact = await prisma.contact.create({
      data: { orgId: org.id, ...c },
    });
    contacts.push(contact);
  }
  console.log(`Created ${contacts.length} demo contacts`);

  // Conversations and messages
  const conversations: { id: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const conv = await prisma.conversation.create({
      data: {
        orgId: org.id,
        contactId: contacts[i].id,
        channelId: whatsappChannel.id,
        status: i < 4 ? ConversationStatus.OPEN : ConversationStatus.CLOSED,
        priority: i % 3 === 0 ? ConversationPriority.HIGH : ConversationPriority.MEDIUM,
        assignedToId: i < 4 ? agent.id : null,
        lastMessageAt: hoursAgo(i * 2),
      },
    });
    conversations.push(conv);

    await prisma.message.createMany({
      data: [
        {
          conversationId: conv.id,
          direction: MessageDirection.INBOUND,
          sender: MessageSender.CONTACT,
          body: i === 0 ? "Hi, I want to book a haircut tomorrow." : `Message ${i + 1} from contact`,
          createdAt: hoursAgo(i * 2 + 1),
        },
        {
          conversationId: conv.id,
          direction: MessageDirection.OUTBOUND,
          sender: MessageSender.AGENT,
          body: "Sure! We have slots at 11 AM and 3 PM. Which works for you?",
          createdAt: hoursAgo(i * 2 + 0.8),
        },
        {
          conversationId: conv.id,
          direction: MessageDirection.INBOUND,
          sender: MessageSender.CONTACT,
          body: "11 AM is perfect.",
          createdAt: hoursAgo(i * 2 + 0.5),
        },
      ],
    });
  }
  console.log("Created demo conversations and messages");

  // Appointments
  const now = new Date();
  const appointmentSlots = [
    { startsAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 11, 0), status: AppointmentStatus.BOOKED, contact: contacts[0], service: services[0], staff: staffProfiles[0] },
    { startsAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 14, 0), status: AppointmentStatus.CONFIRMED, contact: contacts[1], service: services[1], staff: staffProfiles[1] },
    { startsAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0), status: AppointmentStatus.COMPLETED, contact: contacts[2], service: services[0], staff: staffProfiles[0] },
    { startsAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 13, 0), status: AppointmentStatus.IN_PROGRESS, contact: contacts[3], service: services[2], staff: staffProfiles[2] },
    { startsAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 16, 0), status: AppointmentStatus.BOOKED, contact: contacts[4], service: services[3], staff: staffProfiles[2] },
    { startsAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12, 0), status: AppointmentStatus.CANCELLED, contact: contacts[5], service: services[4], staff: staffProfiles[2] },
  ];

  for (const a of appointmentSlots) {
    await prisma.appointment.create({
      data: {
        orgId: org.id,
        contactId: a.contact.id,
        serviceId: a.service.id,
        staffId: a.staff.id,
        startsAt: a.startsAt,
        endsAt: new Date(a.startsAt.getTime() + (a.service.durationMin || 60) * 60000),
        status: a.status,
        notes: "Demo appointment",
      },
    });
  }
  console.log("Created demo appointments");

  // Queue
  const queue = await prisma.queue.create({
    data: { orgId: org.id, name: "Walk-in Queue", isActive: true },
  });
  const queueStatuses = [QueueEntryStatus.WAITING, QueueEntryStatus.CALLED, QueueEntryStatus.IN_PROGRESS, QueueEntryStatus.COMPLETED];
  for (let i = 0; i < 4; i++) {
    await prisma.queueEntry.create({
      data: {
        orgId: org.id,
        queueId: queue.id,
        contactId: contacts[i + 6].id,
        serviceId: services[i % services.length].id,
        staffId: staffProfiles[i % staffProfiles.length].id,
        token: `A${i + 1}`,
        position: i,
        status: queueStatuses[i],
        estimatedWaitMin: (i + 1) * 10,
      },
    });
  }
  console.log("Created demo queue entries");

  // Campaigns
  const campaignDraft = await prisma.campaign.create({
    data: {
      orgId: org.id,
      channelId: whatsappChannel.id,
      name: "Diwali Discount Broadcast",
      description: "20% off all services",
      messageTemplate: "Hi {{name}}, get 20% off on all services this Diwali. Book now!",
      status: CampaignStatus.DRAFT,
      timezone: "Asia/Kolkata",
      totalRecipients: 4,
    },
  });
  const campaignCompleted = await prisma.campaign.create({
    data: {
      orgId: org.id,
      channelId: whatsappChannel.id,
      name: "Membership Renewal",
      description: "Renew your gold membership",
      messageTemplate: "Hi {{name}}, your membership is expiring soon. Renew today!",
      status: CampaignStatus.COMPLETED,
      timezone: "Asia/Kolkata",
      totalRecipients: 3,
      sentCount: 3,
    },
  });
  await prisma.campaignRecipient.createMany({
    data: [
      { campaignId: campaignDraft.id, contactId: contacts[4].id, status: RecipientStatus.PENDING },
      { campaignId: campaignDraft.id, contactId: contacts[6].id, status: RecipientStatus.PENDING },
      { campaignId: campaignDraft.id, contactId: contacts[8].id, status: RecipientStatus.PENDING },
      { campaignId: campaignDraft.id, contactId: contacts[11].id, status: RecipientStatus.PENDING },
      { campaignId: campaignCompleted.id, contactId: contacts[9].id, status: RecipientStatus.SENT, sentAt: hoursAgo(24) },
      { campaignId: campaignCompleted.id, contactId: contacts[10].id, status: RecipientStatus.SENT, sentAt: hoursAgo(24) },
      { campaignId: campaignCompleted.id, contactId: contacts[0].id, status: RecipientStatus.SENT, sentAt: hoursAgo(24) },
    ],
  });
  console.log("Created demo campaigns");

  // Reminders
  await prisma.reminder.createMany({
    data: [
      { orgId: org.id, contactId: contacts[0].id, channelId: whatsappChannel.id, title: "Haircut follow-up", type: ReminderType.FOLLOW_UP, message: "Hi, just reminding you about your haircut booking tomorrow.", assignedToId: agent.id, scheduledFor: daysFromNow(1), status: ReminderStatus.PENDING },
      { orgId: org.id, contactId: contacts[2].id, channelId: whatsappChannel.id, title: "Colour touch-up", type: ReminderType.APPOINTMENT, message: "Your colour touch-up is due next week.", assignedToId: agent.id, scheduledFor: daysFromNow(7), status: ReminderStatus.PENDING },
      { orgId: org.id, contactId: contacts[5].id, channelId: whatsappChannel.id, title: "Payment due", type: ReminderType.PAYMENT, message: "Please clear your pending balance.", assignedToId: admin.id, scheduledFor: hoursAgo(2), status: ReminderStatus.SENT },
      { orgId: org.id, contactId: contacts[7].id, channelId: telegramChannel.id, title: "Facial reminder", type: ReminderType.APPOINTMENT, message: "Your facial is booked for tomorrow.", assignedToId: agent.id, scheduledFor: daysFromNow(1), status: ReminderStatus.PENDING },
    ],
  });
  console.log("Created demo reminders");

  // Job cards (not salon-specific, but useful for testing)
  await prisma.jobCard.createMany({
    data: [
      { orgId: org.id, contactId: contacts[2].id, serviceId: services[1].id, staffId: staffProfiles[1].id, title: "Hair colour correction", description: "Fix uneven colour from previous session.", status: JobCardStatus.IN_PROGRESS, estimateInr: 2500 },
      { orgId: org.id, contactId: contacts[4].id, serviceId: services[0].id, staffId: staffProfiles[0].id, title: "Regular grooming package", description: "Haircut + beard trim.", status: JobCardStatus.DELIVERED, estimateInr: 600 },
    ],
  });
  console.log("Created demo job cards");

  // Memberships
  await prisma.membership.createMany({
    data: [
      { orgId: org.id, contactId: contacts[9].id, name: "Gold Membership", sessionsTotal: 12, sessionsUsed: 3, expiresAt: daysFromNow(90), status: MembershipStatus.ACTIVE },
      { orgId: org.id, contactId: contacts[7].id, name: "Silver Membership", sessionsTotal: 6, sessionsUsed: 5, expiresAt: daysFromNow(10), status: MembershipStatus.EXPIRED },
    ],
  });
  console.log("Created demo memberships");

  // Reviews
  await prisma.review.createMany({
    data: [
      { orgId: org.id, contactId: contacts[0].id, rating: 5, comment: "Great service and friendly staff!" },
      { orgId: org.id, contactId: contacts[3].id, rating: 4, comment: "Loved the facial, but had to wait a bit." },
      { orgId: org.id, contactId: contacts[5].id, rating: 3, comment: "Okay experience, nothing special." },
    ],
  });
  console.log("Created demo reviews");

  // Invoices
  await prisma.invoice.createMany({
    data: [
      { orgId: org.id, type: InvoiceType.SUBSCRIPTION, amountInr: org.monthlyFeeInr || 3999, status: InvoiceStatus.PAID, paidAt: hoursAgo(48) },
      { orgId: org.id, type: InvoiceType.SUBSCRIPTION, amountInr: org.monthlyFeeInr || 3999, status: InvoiceStatus.PENDING },
    ],
  });
  console.log("Created demo invoices");

  // Customer events
  await prisma.customerEvent.createMany({
    data: [
      { orgId: org.id, contactId: contacts[0].id, type: CustomerEventType.APPOINTMENT_BOOKED, entityType: "appointment" },
      { orgId: org.id, contactId: contacts[1].id, type: CustomerEventType.QUEUE_JOINED, entityType: "queueEntry" },
      { orgId: org.id, contactId: contacts[2].id, type: CustomerEventType.SERVICE_COMPLETED, entityType: "appointment" },
      { orgId: org.id, contactId: contacts[3].id, type: CustomerEventType.REVIEW_RECEIVED, entityType: "review" },
      { orgId: org.id, contactId: contacts[9].id, type: CustomerEventType.PAYMENT_RECEIVED, entityType: "invoice" },
    ],
  });
  console.log("Created demo customer events");

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
  console.log("Created demo automations");

  // Audit logs
  await prisma.auditLog.createMany({
    data: [
      { orgId: org.id, userId: owner.id, action: "ORG_CREATED", targetType: "Organization", targetId: org.id, metadata: { note: "Demo org seeded" } as never },
      { orgId: org.id, userId: admin.id, action: "USER_INVITED", targetType: "User", targetId: agent.id, metadata: { role: "AGENT" } as never },
      { orgId: org.id, userId: agent.id, action: "CAMPAIGN_CREATED", targetType: "Campaign", targetId: campaignDraft.id, metadata: { name: campaignDraft.name } as never },
    ],
  });
  console.log("Created demo audit logs");

  console.log("\nDemo seed complete.");
  console.log("Owner login:  ", owner.email, "/", DEMO_PASSWORD);
  console.log("Platform admin login:", platformAdmin.email, "/", DEMO_PLATFORM_ADMIN_PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
