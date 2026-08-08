import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getQueuesByOrg, createQueue, joinQueue } from "@/lib/services/queue-service";
import { getOrgActiveLocationId } from "@/lib/location-scope";

const createQueueSchema = z.object({
  name: z.string().min(1),
  serviceId: z.string().optional(),
  locationId: z.string().optional(),
});

const joinQueueSchema = z.object({
  queueId: z.string().min(1),
  contactId: z.string().min(1),
  serviceId: z.string().optional(),
  staffId: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeLocationId = await getOrgActiveLocationId(session.user.orgId);
  const queues = await getQueuesByOrg(session.user.orgId, activeLocationId);
  return NextResponse.json({ queues, orgSlug: session.user.orgSlug });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createQueueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const activeLocationId = parsed.data.locationId ?? (await getOrgActiveLocationId(session.user.orgId));
  const queue = await createQueue(session.user.orgId, { ...parsed.data, locationId: activeLocationId });
  return NextResponse.json({ queue }, { status: 201 });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = joinQueueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const entry = await joinQueue({
    orgId: session.user.orgId,
    ...parsed.data,
  });

  return NextResponse.json({ entry }, { status: 201 });
}
