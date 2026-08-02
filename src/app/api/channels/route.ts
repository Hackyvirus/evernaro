import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgId, UnauthorizedError } from "@/lib/session";

export async function GET() {
  try {
    const orgId = await requireOrgId();
    const channels = await prisma.channel.findMany({
      where: { orgId },
      select: {
        id: true,
        type: true,
        isActive: true,
        telegramBotUsername: true,
        emailAddress: true,
        emailFromName: true,
        whatsappAppName: true,
        whatsappSourceNumber: true,
        instagramUsername: true,
        instagramPageId: true,
        twilioFromNumber: true,
        voiceLanguage: true,
      },
    });
    return NextResponse.json({ channels });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load channels" }, { status: 500 });
  }
}
