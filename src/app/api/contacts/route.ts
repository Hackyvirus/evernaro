import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { normalizePhone } from "@/lib/phone";
import { logAudit } from "@/lib/audit";

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
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const { name, email, phone, telegramChatId, instagramUserId, company, tags, notes } = parsed.data;

    const contact = await prisma.contact.create({
      data: {
        orgId,
        name: name || undefined,
        email: email ? email.toLowerCase() : undefined,
        phone: phone ? normalizePhone(phone) : undefined,
        telegramChatId: telegramChatId || undefined,
        instagramUserId: instagramUserId || undefined,
        company: company || undefined,
        tags: tags?.filter(Boolean) ?? [],
        notes: notes || undefined,
      },
    });

    await logAudit({
      orgId,
      userId,
      action: "OTHER",
      targetType: "contact",
      targetId: contact.id,
      metadata: { action: "contact_created" },
    });

    return NextResponse.json({ ok: true, contact });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to create contact" }, { status: 500 });
  }
}
