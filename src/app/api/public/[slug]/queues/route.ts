import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isBusinessOpen, formatBusinessStatus } from "@/lib/business-hours";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const ip = clientIp(req);
  const allowed = await checkRateLimit(`public:queues:${slug}:${ip}`, 60, 60);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, name: true, status: true, timezone: true, businessHours: true },
  });

  if (!org || org.status !== "ACTIVE") {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const queues = await prisma.queue.findMany({
    where: { orgId: org.id, isActive: true },
    select: {
      id: true,
      name: true,
      serviceId: true,
      service: { select: { id: true, name: true, durationMin: true, priceInr: true } },
    },
    orderBy: { name: "asc" },
  });

  const open = isBusinessOpen(org.timezone, org.businessHours);
  const status = formatBusinessStatus(org.timezone, org.businessHours);

  return NextResponse.json({
    org: { name: org.name, open, closedMessage: status.message },
    queues,
  });
}
