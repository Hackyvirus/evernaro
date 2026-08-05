import { NextResponse, type NextRequest } from "next/server";
import { UserRole, type ConversationStatus, type ConversationPriority, type ChannelType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";

const validPriorities: ConversationPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const validStatuses: ConversationStatus[] = ["OPEN", "CLOSED"];
const validChannels: ChannelType[] = ["TELEGRAM", "EMAIL", "WHATSAPP", "INSTAGRAM", "VOICE"];

export async function GET(request: NextRequest) {
  try {
    const { orgId, userId } = await requireOrgMember(UserRole.VIEWER);
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim();
    const channel = searchParams.get("channel");
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const assigned = searchParams.get("assigned");
    const filter = searchParams.get("filter");
    const contactId = searchParams.get("contactId");

    const where: { orgId: string; contactId?: string; channel?: { type: ChannelType }; status?: ConversationStatus; priority?: ConversationPriority; assignedToId?: string | null; messages?: { some: { direction?: "INBOUND"; isAiDraft?: boolean } } } = { orgId };

    if (contactId) {
      where.contactId = contactId;
    }

    if (channel && validChannels.includes(channel as ChannelType)) {
      where.channel = { type: channel as ChannelType };
    }

    if (status && validStatuses.includes(status as ConversationStatus)) {
      where.status = status as ConversationStatus;
    }

    if (priority && validPriorities.includes(priority as ConversationPriority)) {
      where.priority = priority as ConversationPriority;
    }

    if (assigned === "me") {
      where.assignedToId = userId;
    } else if (assigned === "none") {
      where.assignedToId = null;
    }

    if (filter === "draft") {
      where.messages = { some: { isAiDraft: true } };
    } else if (filter === "waiting" || filter === "unread") {
      // Approximate unread/waiting as having inbound messages (no explicit read tracking yet).
      where.messages = { some: { direction: "INBOUND" } };
    } else if (filter === "resolved") {
      where.status = "CLOSED";
    }

    if (search) {
      // We build the query with search as a nested OR condition. Because the base
      // where object is typed narrowly, we widen it for this case.
      const base = where as typeof where & { OR: unknown[] };
      base.OR = [
        { contact: { name: { contains: search, mode: "insensitive" } } },
        { contact: { email: { contains: search, mode: "insensitive" } } },
        { contact: { phone: { contains: search, mode: "insensitive" } } },
        { messages: { some: { body: { contains: search, mode: "insensitive" } } } },
      ];
    }

    const conversations = await prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      include: {
        contact: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        channel: { select: { type: true, telegramBotUsername: true, emailAddress: true, whatsappSourceNumber: true, instagramUsername: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    return NextResponse.json({ conversations });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 });
  }
}
