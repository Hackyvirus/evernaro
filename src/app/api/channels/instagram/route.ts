import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgId, UnauthorizedError } from "@/lib/session";
import { channelWebhookSecret } from "@/lib/webhook-secret";
import { encryptSecret } from "@/lib/crypto";

const bodySchema = z.object({
  pageAccessToken: z.string().min(10),
  pageId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const orgId = await requireOrgId();
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Page access token and Page ID are required" }, { status: 400 });
    }
    const { pageAccessToken, pageId } = parsed.data;

    const meRes = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(pageAccessToken)}`
    );
    const me = await meRes.json();
    if (!meRes.ok) {
      return NextResponse.json(
        { error: me?.error?.message || "Invalid Instagram/Facebook Page access token" },
        { status: 400 }
      );
    }

    const encryptedToken = encryptSecret(pageAccessToken);
    const channel = await prisma.channel.upsert({
      where: { orgId_type: { orgId, type: "INSTAGRAM" } },
      update: {
        instagramPageAccessToken: encryptedToken,
        instagramPageId: pageId,
        instagramUsername: me.name,
        isActive: true,
      },
      create: {
        orgId,
        type: "INSTAGRAM",
        instagramPageAccessToken: encryptedToken,
        instagramPageId: pageId,
        instagramUsername: me.name,
      },
    });

    const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/instagram/webhook/${channel.id}?secret=${channelWebhookSecret(channel.id)}`;
    const verifyToken = channelWebhookSecret(channel.id);

    return NextResponse.json({ ok: true, id: channel.id, username: me.name, webhookUrl, verifyToken });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to save Instagram channel" }, { status: 500 });
  }
}
