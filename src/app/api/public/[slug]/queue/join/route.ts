import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { findOrCreateContact, requireContactLimitIfNew, UsageLimitExceededError } from "@/lib/contact-identity";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { joinQueue, QueueDuplicateJoinError } from "@/lib/services/queue-service";
import { isBusinessOpen, formatBusinessStatus } from "@/lib/business-hours";
import { isValidPhone } from "@/lib/phone";

const joinSchema = z.object({
  queueId: z.string().min(1),
  serviceId: z.string().optional(),
  staffId: z.string().optional(),
  name: z.string().trim().min(1).max(100),
  phone: z.string().refine(isValidPhone, { message: "Enter a valid phone number" }),
  email: z.string().trim().email().max(254).optional().or(z.literal("")),
  website: z.string().max(0).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, name: true, status: true, timezone: true, businessHours: true },
  });

  if (!org || org.status !== "ACTIVE") {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const businessOpen = isBusinessOpen(org.timezone, org.businessHours);

  const ip = clientIp(req);
  const allowed = await checkRateLimit(`public:queue:join:${slug}:${ip}`, 10, 15 * 60);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const body = await req.json();
  const parsed = joinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { queueId, serviceId, staffId, name, phone, email } = parsed.data;

  const queue = await prisma.queue.findFirst({
    where: { id: queueId, orgId: org.id, isActive: true },
    select: { id: true },
  });
  if (!queue) {
    return NextResponse.json({ error: "Queue not found" }, { status: 404 });
  }

  if (serviceId) {
    const service = await prisma.service.findFirst({
      where: { id: serviceId, orgId: org.id, isActive: true },
      select: { id: true },
    });
    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }
  }

  if (staffId) {
    const staff = await prisma.staffProfile.findFirst({
      where: { id: staffId, orgId: org.id, isActive: true },
      select: { id: true },
    });
    if (!staff) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }
  }

  try {
    await requireContactLimitIfNew({ name, phone, email: email || undefined }, org.id);
  } catch (err) {
    if (err instanceof UsageLimitExceededError) {
      return NextResponse.json({ error: err.message }, { status: 402 });
    }
    throw err;
  }

  const contact = await findOrCreateContact({ name, phone, email: email || undefined }, org.id);

  try {
    const entry = await joinQueue({
      orgId: org.id,
      queueId,
      contactId: contact.id,
      serviceId,
      staffId,
      isAfterHours: !businessOpen,
    });

    const closedMessage = businessOpen ? undefined : formatBusinessStatus(org.timezone, org.businessHours).message;
    return NextResponse.json(
      {
        entry: {
          token: entry.token,
          publicToken: entry.publicToken,
          position: entry.position,
          estimatedWaitMin: entry.estimatedWaitMin,
          isAfterHours: entry.isAfterHours,
          queue: entry.queue ? { name: entry.queue.name } : null,
        },
        closedMessage,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof QueueDuplicateJoinError) {
      return NextResponse.json(
        { error: "You are already in this queue" },
        { status: 409 }
      );
    }
    throw err;
  }
}
