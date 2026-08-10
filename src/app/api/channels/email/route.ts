import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { encryptSecretOrNull } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";
import { validateResendApiKey } from "@/lib/email";

const bodySchema = z.object({
  emailAddress: z.string().email(),
  emailFromName: z.string().min(1),
  resendApiKey: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const { orgId, userId } = await requireOrgMember(UserRole.ADMIN);
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "A valid email address and sender name are required" }, { status: 400 });
    }
    const { emailAddress, emailFromName, resendApiKey } = parsed.data;

    if (resendApiKey) {
      try {
        await validateResendApiKey(resendApiKey);
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Invalid Resend API key" },
          { status: 400 }
        );
      }
    }

    const encryptedResendKey = encryptSecretOrNull(resendApiKey);

    const channel = await prisma.channel.upsert({
      where: { orgId_type: { orgId, type: "EMAIL" } },
      update: {
        emailAddress: emailAddress.toLowerCase(),
        emailFromName,
        resendApiKey: encryptedResendKey,
        isActive: true,
      },
      create: {
        orgId,
        type: "EMAIL",
        emailAddress: emailAddress.toLowerCase(),
        emailFromName,
        resendApiKey: encryptedResendKey,
      },
    });

    await logAudit({
      orgId,
      userId,
      action: "CHANNEL_CONNECTED",
      targetType: "Channel",
      targetId: channel.id,
      metadata: { type: "EMAIL", emailAddress: channel.emailAddress },
    });

    return NextResponse.json({ ok: true, id: channel.id, emailAddress: channel.emailAddress });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to save email channel" }, { status: 500 });
  }
}
