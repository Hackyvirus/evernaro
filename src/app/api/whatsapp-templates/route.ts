import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { decryptSecret } from "@/lib/crypto";
import { gupshupCreateTemplate } from "@/lib/whatsapp";
import { whatsappTemplateBodySchema } from "@/lib/whatsapp-template-validation";

export async function GET() {
  try {
    const { orgId } = await requireOrgMember(UserRole.VIEWER);
    const channel = await prisma.channel.findFirst({ where: { orgId, type: "WHATSAPP" } });
    if (!channel) {
      return NextResponse.json({ templates: [] });
    }
    const templates = await prisma.whatsAppTemplate.findMany({
      where: { channelId: channel.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ templates });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load templates" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { orgId } = await requireOrgMember(UserRole.ADMIN);
    const parsed = whatsappTemplateBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid template" },
        { status: 400 }
      );
    }
    const { name, category, language, bodyText } = parsed.data;

    const channel = await prisma.channel.findFirst({ where: { orgId, type: "WHATSAPP" } });
    if (!channel || !channel.whatsappApiKey) {
      return NextResponse.json({ error: "Connect WhatsApp before adding templates" }, { status: 400 });
    }
    if (!channel.whatsappAppId) {
      return NextResponse.json(
        { error: "Add your Gupshup App ID in the WhatsApp settings tab first — templates need it" },
        { status: 400 }
      );
    }

    const existing = await prisma.whatsAppTemplate.findUnique({
      where: { channelId_name: { channelId: channel.id, name } },
    });
    if (existing) {
      return NextResponse.json({ error: "A template with this name already exists" }, { status: 400 });
    }

    const template = await prisma.whatsAppTemplate.create({
      data: { channelId: channel.id, name, category, language, bodyText, status: "PENDING" },
    });

    try {
      const example = bodyText.replace(/\{\{1\}\}/g, "there");
      const result = await gupshupCreateTemplate({
        apiKey: decryptSecret(channel.whatsappApiKey),
        appId: channel.whatsappAppId,
        elementName: name,
        category,
        languageCode: language,
        content: bodyText,
        example,
      });
      const updated = await prisma.whatsAppTemplate.update({
        where: { id: template.id },
        data: {
          gupshupTemplateId: result.template?.id ?? null,
          status: result.template?.status === "APPROVED" ? "APPROVED" : "PENDING",
        },
      });
      return NextResponse.json({ ok: true, template: updated });
    } catch (err) {
      // Saved locally either way — surface the real Gupshup error so it can
      // be diagnosed (wrong App ID, API not enabled, etc.) rather than
      // silently leaving the template stuck in PENDING with no explanation.
      const message = err instanceof Error ? err.message : "Gupshup submission failed";
      const updated = await prisma.whatsAppTemplate.update({
        where: { id: template.id },
        data: { rejectionReason: message },
      });
      return NextResponse.json({ ok: true, template: updated, warning: message });
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
