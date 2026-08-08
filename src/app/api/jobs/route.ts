import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";

const createSchema = z.object({
  contactId: z.string().min(1),
  serviceId: z.string().optional(),
  staffId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  estimateInr: z.coerce.number().int().min(0).optional(),
});

export async function GET() {
  try {
    const { orgId } = await requireOrgMember(UserRole.VIEWER);

    const jobCards = await prisma.jobCard.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      include: {
        contact: { select: { id: true, name: true, email: true, phone: true, telegramChatId: true, instagramUserId: true } },
        service: { select: { id: true, name: true } },
        staff: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ jobCards });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load job cards" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { orgId } = await requireOrgMember(UserRole.AGENT);
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { contactId, serviceId, staffId, title, description, estimateInr } = parsed.data;

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, orgId },
      select: { id: true },
    });
    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    if (serviceId) {
      const service = await prisma.service.findFirst({
        where: { id: serviceId, orgId },
        select: { id: true },
      });
      if (!service) {
        return NextResponse.json({ error: "Service not found" }, { status: 404 });
      }
    }

    if (staffId) {
      const staff = await prisma.staffProfile.findFirst({
        where: { id: staffId, orgId },
        select: { id: true },
      });
      if (!staff) {
        return NextResponse.json({ error: "Staff not found" }, { status: 404 });
      }
    }

    const jobCard = await prisma.jobCard.create({
      data: {
        orgId,
        contactId,
        serviceId,
        staffId,
        title,
        description,
        estimateInr,
      },
      include: {
        contact: { select: { id: true, name: true, email: true, phone: true, telegramChatId: true, instagramUserId: true } },
        service: { select: { id: true, name: true } },
        staff: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ jobCard }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to create job card" }, { status: 500 });
  }
}
