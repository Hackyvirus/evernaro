import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdminId, UnauthorizedError } from "@/lib/session";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdminId();
    const { id } = await params;

    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, name: true, email: true, role: true, createdAt: true } },
        businessProfile: { select: { industry: true, description: true } },
        channels: {
          select: {
            id: true,
            type: true,
            isActive: true,
            telegramBotUsername: true,
            emailAddress: true,
            whatsappAppName: true,
            whatsappSourceNumber: true,
            instagramUsername: true,
            twilioFromNumber: true,
            createdAt: true,
          },
        },
        invoices: { orderBy: { createdAt: "desc" } },
        _count: { select: { contacts: true, conversations: true, campaigns: true, reminders: true } },
      },
    });
    if (!org) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const lastConversation = await prisma.conversation.findFirst({
      where: { orgId: id },
      orderBy: { lastMessageAt: "desc" },
      select: { lastMessageAt: true },
    });

    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        createdAt: org.createdAt,
        monthlyFeeInr: org.monthlyFeeInr,
        industry: org.businessProfile?.industry ?? null,
        description: org.businessProfile?.description ?? null,
        users: org.users,
        channels: org.channels,
        invoices: org.invoices,
        contactCount: org._count.contacts,
        conversationCount: org._count.conversations,
        campaignCount: org._count.campaigns,
        reminderCount: org._count.reminders,
        lastActivityAt: lastConversation?.lastMessageAt ?? null,
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load client" }, { status: 500 });
  }
}

const bodySchema = z.object({
  monthlyFeeInr: z.number().int().nonnegative().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePlatformAdminId();
    const { id } = await params;

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const existing = await prisma.organization.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const org = await prisma.organization.update({
      where: { id },
      data: { monthlyFeeInr: parsed.data.monthlyFeeInr },
    });

    return NextResponse.json({ ok: true, monthlyFeeInr: org.monthlyFeeInr });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to update client" }, { status: 500 });
  }
}
