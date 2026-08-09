import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const { orgId } = await requireOrgMember(UserRole.VIEWER);
    const [profile, org] = await Promise.all([
      prisma.businessProfile.findUnique({ where: { orgId } }),
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, timezone: true, businessHours: true },
      }),
    ]);
    return NextResponse.json({ profile, org });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}

const businessHoursSchema = z.array(
  z.object({
    day: z.number().int().min(0).max(6),
    open: z.string().regex(/^\d{2}:\d{2}$/),
    close: z.string().regex(/^\d{2}:\d{2}$/),
  })
);

const bodySchema = z.object({
  businessName: z.string().min(1),
  industry: z.string().optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  workingHours: z.string().optional(),
  tone: z.string().optional(),
  formality: z.string().optional(),
  language: z.string().optional(),
  knowledgeBase: z.string().optional(),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
  products: z.array(z.object({ name: z.string(), description: z.string().optional(), price: z.string().optional(), availability: z.string().optional(), terms: z.string().optional() })).optional(),
  policies: z.array(z.object({ title: z.string(), body: z.string() })).optional(),
  aiInstructions: z.object({ neverSay: z.string().optional(), escalate: z.string().optional() }).optional(),
  signOff: z.string().optional(),
  timezone: z.string().optional(),
  businessHours: businessHoursSchema.optional(),
});

export async function PUT(req: Request) {
  try {
    const { orgId, userId } = await requireOrgMember(UserRole.ADMIN);
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const data = parsed.data;
    const { timezone, businessHours, ...profileData } = data;

    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: orgId },
        data: {
          name: data.businessName,
          ...(timezone !== undefined ? { timezone } : {}),
          ...(businessHours !== undefined ? { businessHours } : {}),
        },
      });
      await tx.businessProfile.upsert({
        where: { orgId },
        update: profileData,
        create: { orgId, ...profileData },
      });
    });

    const profile = await prisma.businessProfile.findUnique({ where: { orgId } });
    if (!profile) {
      return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
    }

    await logAudit({
      orgId,
      userId,
      action: "KNOWLEDGE_BASE_CHANGED",
      targetType: "BusinessProfile",
      targetId: profile.id,
      metadata: { businessName: data.businessName },
    });

    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
}
