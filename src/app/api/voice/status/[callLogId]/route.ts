import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { channelWebhookSecret, secureCompare } from "@/lib/webhook-secret";
import { mapTwilioStatus } from "@/lib/voice";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ callLogId: string }> }
) {
  const { callLogId } = await params;

  const secret = new URL(req.url).searchParams.get("secret");
  if (!secureCompare(secret, channelWebhookSecret(callLogId))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const form = await req.formData();
  const callStatus = form.get("CallStatus");
  if (typeof callStatus !== "string") {
    return NextResponse.json({ ok: true });
  }

  await prisma.callLog.update({
    where: { id: callLogId },
    data: { status: mapTwilioStatus(callStatus) },
  });

  return NextResponse.json({ ok: true });
}
