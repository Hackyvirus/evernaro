import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { channelWebhookSecret, secureCompare } from "@/lib/webhook-secret";
import { buildSayTwiml, verifyTwilioSignature } from "@/lib/voice";

function paramsFromUrl(url: string): Record<string, string> {
  const searchParams = new URL(url).searchParams;
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

// Twilio calls this (GET or POST, depending on how the call was placed) to
// fetch the instructions for what to say on the call.
async function handle(
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

  // Validate Twilio's signature using the channel auth token when available.
  if (callLog.channel.twilioAuthToken) {
    const signature = req.headers.get("x-twilio-signature");
    let paramsRecord: Record<string, string>;
    if (req.method === "POST") {
      const form = await req.formData();
      paramsRecord = {};
      form.forEach((value, key) => {
        if (typeof value === "string") paramsRecord[key] = value;
      });
    } else {
      paramsRecord = paramsFromUrl(req.url);
    }
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

  const twiml = buildSayTwiml(callLog.message, callLog.channel.voiceLanguage);
  return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
}

export const GET = handle;
export const POST = handle;
