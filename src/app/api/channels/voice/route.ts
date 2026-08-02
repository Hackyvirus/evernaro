import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgId, UnauthorizedError } from "@/lib/session";
import { encryptSecret } from "@/lib/crypto";

const bodySchema = z.object({
  accountSid: z.string().min(10),
  authToken: z.string().min(10),
  fromNumber: z.string().min(8),
  language: z.string().min(2).default("en-IN"),
});

export async function POST(req: Request) {
  try {
    const orgId = await requireOrgId();
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Account SID, auth token, and from number are all required" },
        { status: 400 }
      );
    }
    const { accountSid, authToken, fromNumber, language } = parsed.data;

    const verifyRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      },
    });
    if (!verifyRes.ok) {
      return NextResponse.json({ error: "Invalid Twilio Account SID / Auth Token" }, { status: 400 });
    }

    const encryptedAuthToken = encryptSecret(authToken);
    const channel = await prisma.channel.upsert({
      where: { orgId_type: { orgId, type: "VOICE" } },
      update: {
        twilioAccountSid: accountSid,
        twilioAuthToken: encryptedAuthToken,
        twilioFromNumber: fromNumber,
        voiceLanguage: language,
        isActive: true,
      },
      create: {
        orgId,
        type: "VOICE",
        twilioAccountSid: accountSid,
        twilioAuthToken: encryptedAuthToken,
        twilioFromNumber: fromNumber,
        voiceLanguage: language,
      },
    });

    return NextResponse.json({ ok: true, id: channel.id });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to save voice channel" }, { status: 500 });
  }
}
