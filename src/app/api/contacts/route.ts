import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { findOrCreateContact, requireContactLimitIfNew, UsageLimitExceededError } from "@/lib/contact-identity";
import { logAudit } from "@/lib/audit";
import { requireActiveSubscription, SubscriptionSuspendedError } from "@/lib/subscription";

export async function GET(request: NextRequest) {
  try {
    const { orgId } = await requireOrgMember(UserRole.VIEWER);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const channel = searchParams.get("channel");
    const tag = searchParams.get("tag");

    const where: { orgId: string; AND?: object[] } = { orgId };
    const and: object[] = [];

    if (search) {
      and.push({
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    if (channel === "email") and.push({ email: { not: null } });
    else if (channel === "phone") and.push({ phone: { not: null } });
    else if (channel === "telegram") and.push({ telegramChatId: { not: null } });
    else if (channel === "instagram") and.push({ instagramUserId: { not: null } });
    else if (channel === "whatsapp") and.push({ phone: { not: null } });

    if (tag) and.push({ tags: { has: tag } });

    if (and.length) where.AND = and;

    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { conversations: true, campaignRecipients: true, reminders: true } },
      },
    });
    return NextResponse.json({ contacts });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load contacts" }, { status: 500 });
  }
}

const bodySchema = z
  .object({
    name: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
    telegramChatId: z.string().optional(),
    instagramUserId: z.string().optional(),
    company: z.string().optional(),
    tags: z.array(z.string()).optional(),
    notes: z.string().optional(),
  })
  .refine((d) => d.email || d.phone || d.telegramChatId || d.instagramUserId, {
    message: "At least one of email, phone, Telegram chat ID, or Instagram user ID is required",
  });

export async function POST(req: Request) {
  try {
    const { orgId, userId } = await requireOrgMember(UserRole.AGENT);
    await requireActiveSubscription(orgId);
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const { name, email, phone, telegramChatId, instagramUserId, company, tags, notes } = parsed.data;

    try {
      await requireContactLimitIfNew({ name, email, phone, telegramChatId, instagramUserId }, orgId);
    } catch (err) {
      if (err instanceof UsageLimitExceededError) {
        return NextResponse.json({ error: err.message }, { status: 402 });
      }
      throw err;
    }

    const contact = await findOrCreateContact(
      { name, email, phone, telegramChatId, instagramUserId },
      orgId
    );

    const updateData: {
      company?: string;
      tags?: string[];
      notes?: string;
    } = {};
    if (company) updateData.company = company;
    if (tags?.filter(Boolean).length) updateData.tags = tags.filter(Boolean);
    if (notes) updateData.notes = notes;

    let returnedContact = contact;
    if (Object.keys(updateData).length > 0) {
      returnedContact = await prisma.contact.update({ where: { id: contact.id }, data: updateData });
    }

    await logAudit({
      orgId,
      userId,
      action: "OTHER",
      targetType: "contact",
      targetId: contact.id,
      metadata: { action: "contact_created" },
    });

    return NextResponse.json({ ok: true, contact: returnedContact });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (err instanceof SubscriptionSuspendedError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to create contact" }, { status: 500 });
  }
}
