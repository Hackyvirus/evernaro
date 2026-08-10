import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { channelWebhookSecret, secureCompare } from "@/lib/webhook-secret";
import { mapTwilioStatus, verifyTwilioSignature } from "@/lib/voice";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ callLogId: string }> }
) {
  const { callLogId } = await params;

  const secret = new URL(req.url).searchParams.get("secret");
  if (!secureCompare(secret, channelWebhookSecret(callLogId))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const callLog = await prisma.callLog.findUnique({
    where: { id: callLogId },
    include: { channel: true },
  });
  if (!callLog) {
    return new NextResponse("Not found", { status: 404 });
  }

  const form = await req.formData();
  const paramsRecord: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === "string") paramsRecord[key] = value;
  });

  // Validate Twilio's signature using the channel auth token when available.
  if (callLog.channel.twilioAuthToken) {
    const signature = req.headers.get("x-twilio-signature");
    const valid = verifyTwilioSignature(
      callLog.channel.twilioAuthToken,
      req.url,
      paramsRecord,
      signature
    );
    if (!valid) {
      return new NextResponse("Invalid signature", { status: 401 });
    }
  }

  const callStatus = form.get("CallStatus");
  if (typeof callStatus !== "string") {
    return NextResponse.json({ ok: true });
  }

  try {
    await prisma.callLog.update({
      where: { id: callLogId },
      data: { status: mapTwilioStatus(callStatus) },
    });
  } catch (err) {
    console.error(`Voice status update failed for callLog ${callLogId}:`, err);
  }

  return NextResponse.json({ ok: true });
}
