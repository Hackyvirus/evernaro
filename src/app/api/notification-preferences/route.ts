import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";

const CHANNELS = ["WHATSAPP", "EMAIL", "SMS"] as const;

const preferenceSchema = z.object({
  contactId: z.string().min(1, "Contact is required"),
  channel: z.enum(CHANNELS),
  enabled: z.boolean(),
  events: z.array(z.string()).default([]),
});

export async function GET(request: NextRequest) {
  try {
    const { orgId } = await requireOrgMember(UserRole.VIEWER);
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contactId");

    if (contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: contactId, orgId },
        select: { id: true },
      });
      if (!contact) {
        return NextResponse.json({ error: "Contact not found" }, { status: 404 });
      }
    }

    const preferences = await prisma.notificationPreference.findMany({
      where: { orgId, ...(contactId ? { contactId } : {}) },
      orderBy: [{ contactId: "asc" }, { channel: "asc" }],
    });

    return NextResponse.json({ preferences });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load preferences" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return upsertPreference(req);
}

export async function PUT(req: Request) {
  return upsertPreference(req);
}

async function upsertPreference(req: Request) {
  try {
    const { orgId } = await requireOrgMember(UserRole.ADMIN);
    const body = await req.json();
    const parsed = preferenceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { contactId, channel, enabled, events } = parsed.data;

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, orgId },
      select: { id: true },
    });
    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const preference = await prisma.notificationPreference.upsert({
      where: { orgId_contactId_channel: { orgId, contactId, channel } },
      create: { orgId, contactId, channel, enabled, events },
      update: { enabled, events },
    });

    return NextResponse.json({ preference });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to save preference" }, { status: 500 });
  }
}
