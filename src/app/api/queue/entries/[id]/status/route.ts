import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { updateQueueEntryStatus } from "@/lib/services/queue-service";
import { QueueEntryStatus } from "@prisma/client";

const statusSchema = z.object({
  status: z.nativeEnum(QueueEntryStatus),
  staffId: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  await updateQueueEntryStatus(id, session.user.orgId, parsed.data.status, { staffId: parsed.data.staffId });
  return NextResponse.json({ ok: true });
}
