import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgId, UnauthorizedError } from "@/lib/session";

export async function GET() {
  try {
    const orgId = await requireOrgId();
    const conversations = await prisma.conversation.findMany({
      where: { orgId },
      orderBy: { lastMessageAt: "desc" },
      include: {
        contact: true,
        channel: { select: { type: true, telegramBotUsername: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    return NextResponse.json({ conversations });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 });
  }
}
