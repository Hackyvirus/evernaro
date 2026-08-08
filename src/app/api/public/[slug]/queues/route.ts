import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, name: true, status: true },
  });

  if (!org || org.status !== "ACTIVE") {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const queues = await prisma.queue.findMany({
    where: { orgId: org.id, isActive: true },
    include: { service: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ org: { name: org.name }, queues });
}
