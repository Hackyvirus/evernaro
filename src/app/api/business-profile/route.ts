import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const { orgId } = await requireOrgMember(UserRole.VIEWER);
    const profile = await prisma.businessProfile.findUnique({ where: { orgId } });
    return NextResponse.json({ profile });
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
});

export async function PUT(req: Request) {
  try {
    const { orgId, userId } = await requireOrgMember(UserRole.ADMIN);
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const data = parsed.data;

    const profile = await prisma.businessProfile.upsert({
      where: { orgId },
      update: data,
      create: { orgId, ...data },
    });

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
