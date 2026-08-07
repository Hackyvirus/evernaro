import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdminId, UnauthorizedError } from "@/lib/session";

export async function GET() {
  try {
    await requirePlatformAdminId();
    const services = await prisma.billableService.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { limits: true, usageRecords: true } } },
    });
    return NextResponse.json({ services });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load services" }, { status: 500 });
  }
}

const bodySchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().min(1).default("Usage"),
  unit: z.string().min(1),
  billingType: z.enum(["FIXED", "PER_SEAT", "PER_CONTACT", "PER_MESSAGE", "PER_CONVERSATION", "PER_MINUTE", "PER_CREDIT", "PER_GB", "ONE_TIME", "USAGE_TIER", "PERCENTAGE"]).default("USAGE_TIER"),
  basePriceInr: z.number().nonnegative().default(0),
});

export async function POST(req: Request) {
  try {
    await requirePlatformAdminId();
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const service = await prisma.billableService.upsert({
      where: { key: parsed.data.key },
      update: parsed.data,
      create: parsed.data,
    });
    return NextResponse.json({ service }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to create service:", err);
    return NextResponse.json({ error: "Failed to create service" }, { status: 500 });
  }
}
