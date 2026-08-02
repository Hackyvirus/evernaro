import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgId, UnauthorizedError } from "@/lib/session";

export async function GET() {
  try {
    const orgId = await requireOrgId();
    const profile = await prisma.businessProfile.findUnique({ where: { orgId } });
    return NextResponse.json({ profile });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}

const bodySchema = z.object({
  businessName: z.string().min(1),
  industry: z.string().optional(),
  description: z.string().optional(),
  tone: z.string().optional(),
  knowledgeBase: z.string().optional(),
  signOff: z.string().optional(),
});

export async function PUT(req: Request) {
  try {
    const orgId = await requireOrgId();
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

    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
}
