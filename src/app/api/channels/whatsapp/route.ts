import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { channelWebhookSecret } from "@/lib/webhook-secret";
import { encryptSecret } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";

const bodySchema = z.object({
  apiKey: z.string().min(5),
  appName: z.string().min(1),
  appId: z.string().optional(),
  sourceNumber: z.string().min(8),
});

export async function POST(req: Request) {
  try {
    const { orgId, userId } = await requireOrgMember(UserRole.ADMIN);
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "API key, app name, and source number are all required" },
        { status: 400 }
      );
    }
    const { apiKey, appName, appId, sourceNumber } = parsed.data;
    const encryptedApiKey = encryptSecret(apiKey);

    const channel = await prisma.channel.upsert({
      where: { orgId_type: { orgId, type: "WHATSAPP" } },
      update: {
        whatsappApiKey: encryptedApiKey,
        whatsappAppName: appName,
        whatsappAppId: appId || null,
        whatsappSourceNumber: sourceNumber,
        isActive: true,
      },
      create: {
        orgId,
        type: "WHATSAPP",
        whatsappApiKey: encryptedApiKey,
        whatsappAppName: appName,
        whatsappAppId: appId || null,
        whatsappSourceNumber: sourceNumber,
      },
    });

    const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/whatsapp/webhook/${channel.id}?secret=${channelWebhookSecret(channel.id)}`;

    await logAudit({
      orgId,
      userId,
      action: "CHANNEL_CONNECTED",
      targetType: "Channel",
      targetId: channel.id,
      metadata: { type: "WHATSAPP", appName, sourceNumber },
    });

    return NextResponse.json({ ok: true, id: channel.id, webhookUrl });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to save WhatsApp channel" }, { status: 500 });
  }
}
