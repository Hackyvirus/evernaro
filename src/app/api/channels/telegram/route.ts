import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgId, UnauthorizedError } from "@/lib/session";
import { telegramGetMe, telegramSetWebhook } from "@/lib/telegram";
import { encryptSecret } from "@/lib/crypto";

const bodySchema = z.object({ botToken: z.string().min(10) });

export async function POST(req: Request) {
  try {
    const orgId = await requireOrgId();
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "A valid bot token is required" }, { status: 400 });
    }
    const { botToken } = parsed.data;

    const me = await telegramGetMe(botToken);

    const encryptedToken = encryptSecret(botToken);
    const channel = await prisma.channel.upsert({
      where: { orgId_type: { orgId, type: "TELEGRAM" } },
      update: { telegramBotToken: encryptedToken, telegramBotUsername: me.username, isActive: true },
      create: {
        orgId,
        type: "TELEGRAM",
        telegramBotToken: encryptedToken,
        telegramBotUsername: me.username,
      },
    });

    await telegramSetWebhook(botToken, channel.id);

    return NextResponse.json({
      ok: true,
      id: channel.id,
      botUsername: channel.telegramBotUsername,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Failed to connect Telegram bot";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
