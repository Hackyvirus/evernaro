import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgId, UnauthorizedError } from "@/lib/session";
import { decryptSecret } from "@/lib/crypto";
import { gupshupGetTemplateStatus } from "@/lib/whatsapp";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = await requireOrgId();
    const { id } = await params;

    const template = await prisma.whatsAppTemplate.findFirst({
      where: { id, channel: { orgId, type: "WHATSAPP" } },
      include: { channel: true },
    });
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    if (!template.gupshupTemplateId || !template.channel.whatsappApiKey || !template.channel.whatsappAppId) {
      return NextResponse.json(
        { error: "This template was never successfully submitted to Gupshup — re-check the App ID and try adding it again" },
        { status: 400 }
      );
    }

    const remote = await gupshupGetTemplateStatus({
      apiKey: decryptSecret(template.channel.whatsappApiKey),
      appId: template.channel.whatsappAppId,
      gupshupTemplateId: template.gupshupTemplateId,
    });

    if (!remote) {
      return NextResponse.json({ error: "Gupshup no longer reports this template — it may have been deleted" }, { status: 404 });
    }

    const status = remote.status === "APPROVED" ? "APPROVED" : remote.status === "REJECTED" ? "REJECTED" : "PENDING";
    const updated = await prisma.whatsAppTemplate.update({
      where: { id: template.id },
      data: { status, rejectionReason: remote.reason ?? null },
    });

    return NextResponse.json({ ok: true, template: updated });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Failed to sync template status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
