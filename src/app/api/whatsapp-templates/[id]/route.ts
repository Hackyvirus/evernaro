import { NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { decryptSecret } from "@/lib/crypto";
import { gupshupDeleteTemplate } from "@/lib/whatsapp";

// Deletes on Gupshup first, then locally -- the local row's `name` is
// unique per channel, and a rejected/failed template needs its name freed
// up before the same name can be resubmitted with a corrected body.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { orgId } = await requireOrgMember(UserRole.ADMIN);
    const { id } = await params;

    const template = await prisma.whatsAppTemplate.findFirst({
      where: { id, channel: { orgId, type: "WHATSAPP" } },
      include: { channel: true },
    });
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    if (template.gupshupTemplateId && template.channel.whatsappApiKey && template.channel.whatsappAppId) {
      try {
        await gupshupDeleteTemplate({
          apiKey: decryptSecret(template.channel.whatsappApiKey),
          appId: template.channel.whatsappAppId,
          elementName: template.name,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Gupshup deletion failed";
        return NextResponse.json({ error: `Not deleted -- Gupshup rejected the request: ${message}` }, { status: 502 });
      }
    }

    try {
      await prisma.whatsAppTemplate.delete({ where: { id: template.id } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
        return NextResponse.json(
          { error: "This template is already used by a campaign or reminder, so it can't be deleted." },
          { status: 409 }
        );
      }
      throw err;
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "Failed to delete template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
