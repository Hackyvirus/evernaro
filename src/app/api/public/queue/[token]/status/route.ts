import { NextResponse } from "next/server";
import {
  getPublicQueueStatus,
  cancelQueueEntryByPublicToken,
} from "@/lib/services/queue-service";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const status = await getPublicQueueStatus(token);
  if (!status) {
    return NextResponse.json({ error: "Queue entry not found" }, { status: 404 });
  }
  return NextResponse.json({ status });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const entry = await cancelQueueEntryByPublicToken(token);
  if (!entry) {
    return NextResponse.json({ error: "Queue entry not found" }, { status: 404 });
  }
  return NextResponse.json({ entry });
}
