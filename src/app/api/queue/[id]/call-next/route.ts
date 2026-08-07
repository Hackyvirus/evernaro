import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { callNextInQueue } from "@/lib/services/queue-service";

const schema = z.object({
  staffId: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  const entry = await callNextInQueue(id, session.user.orgId, parsed.data?.staffId);
  if (!entry) {
    return NextResponse.json({ error: "No waiting entries" }, { status: 404 });
  }

  return NextResponse.json({ entry });
}
