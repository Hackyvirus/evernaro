import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { channelWebhookSecret, secureCompare } from "@/lib/webhook-secret";
import { buildSayTwiml } from "@/lib/voice";

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

  const twiml = buildSayTwiml(callLog.message, callLog.channel.voiceLanguage);
  return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
}

export const GET = handle;
export const POST = handle;
