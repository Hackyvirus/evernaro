import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, name: true, status: true, industryTemplateId: true },
  });

  if (!org || org.status !== "ACTIVE") {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const [services, staff] = await Promise.all([
    prisma.service.findMany({
      where: { orgId: org.id, isActive: true },
      select: { id: true, name: true, durationMin: true, priceInr: true, description: true },
      orderBy: { name: "asc" },
    }),
    prisma.staffProfile.findMany({
      where: { orgId: org.id, isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({ org: { name: org.name }, services, staff });
}
