import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdminId, UnauthorizedError } from "@/lib/session";
import { BillingFrequency } from "@prisma/client";

export async function GET() {
  try {
    await requirePlatformAdminId();
    const addOns = await prisma.addOn.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { planAddOns: true, subscriptionItems: true } } },
    });
    return NextResponse.json({ addOns });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load add-ons" }, { status: 500 });
  }
}

const bodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  priceInr: z.number().int().nonnegative(),
  frequency: z.nativeEnum(BillingFrequency).default(BillingFrequency.MONTHLY),
  minQuantity: z.number().int().nonnegative().default(1),
  maxQuantity: z.number().int().nonnegative().nullable().default(null),
  isActive: z.boolean().default(true),
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
    const addOn = await prisma.addOn.create({ data: parsed.data });
    return NextResponse.json({ addOn }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to create add-on:", err);
    return NextResponse.json({ error: "Failed to create add-on" }, { status: 500 });
  }
}
