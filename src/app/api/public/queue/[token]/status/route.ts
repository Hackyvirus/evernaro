import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import {
  getPublicQueueStatus,
  cancelQueueEntryByPublicToken,
} from "@/lib/services/queue-service";

const cancelSchema = z.object({
  phone: z.string().min(1),
});

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = clientIp(req);
  const allowed = await checkRateLimit(`public:queue:status:get:${token}:${ip}`, 60, 60);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const status = await getPublicQueueStatus(token);
  if (!status) {
    return NextResponse.json({ error: "Queue entry not found" }, { status: 404 });
  }
  return NextResponse.json({ status });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = clientIp(req);
  const allowed = await checkRateLimit(`public:queue:status:delete:${token}:${ip}`, 10, 60);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: { verificationCode?: string } = {};
  try {
    body = await req.json();
  } catch {
    // no body
  }
  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Phone number is required to leave the queue" },
      { status: 400 }
    );
  }

  const entry = await cancelQueueEntryByPublicToken(token, undefined, parsed.data.phone);
  if (!entry) {
    return NextResponse.json({ error: "Queue entry not found" }, { status: 404 });
  }
  if (entry.error) {
    return NextResponse.json({ error: entry.error }, { status: 400 });
  }
  return NextResponse.json({ entry: { token: entry.token, publicToken: entry.publicToken, status: entry.status } });
}
