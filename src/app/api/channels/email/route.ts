import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgId, UnauthorizedError } from "@/lib/session";
import { encryptSecretOrNull } from "@/lib/crypto";

const bodySchema = z.object({
  emailAddress: z.string().email(),
  emailFromName: z.string().min(1),
  resendApiKey: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const orgId = await requireOrgId();
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "A valid email address and sender name are required" }, { status: 400 });
    }
    const { emailAddress, emailFromName, resendApiKey } = parsed.data;
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

    return NextResponse.json({ ok: true, id: channel.id, emailAddress: channel.emailAddress });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to save email channel" }, { status: 500 });
  }
}
