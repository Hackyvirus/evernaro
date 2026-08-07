import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdminId, UnauthorizedError } from "@/lib/session";
import { CouponType, CouponDuration } from "@prisma/client";

export async function GET() {
  try {
    await requirePlatformAdminId();
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { redemptions: true } } },
    });
    return NextResponse.json({ coupons });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load coupons" }, { status: 500 });
  }
}

const bodySchema = z.object({
  code: z.string().min(1),
  description: z.string().optional(),
  type: z.nativeEnum(CouponType),
  value: z.number().nonnegative(),
  duration: z.nativeEnum(CouponDuration).default(CouponDuration.ONCE),
  durationInMonths: z.number().int().nonnegative().nullable().default(null),
  maxRedemptions: z.number().int().nonnegative().nullable().default(null),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  minAmountInr: z.number().int().nonnegative().nullable().default(null),
  applicablePlanIds: z.array(z.string().cuid()).default([]),
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
    const data = parsed.data;
    const coupon = await prisma.coupon.create({
      data: {
        code: data.code.toUpperCase(),
        description: data.description,
        type: data.type,
        value: data.value,
        duration: data.duration,
        durationInMonths: data.durationInMonths,
        maxRedemptions: data.maxRedemptions,
        validFrom: data.validFrom ? new Date(data.validFrom) : new Date(),
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        minAmountInr: data.minAmountInr,
        applicablePlanIds: data.applicablePlanIds,
        isActive: data.isActive,
      },
    });
    return NextResponse.json({ coupon }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to create coupon:", err);
    return NextResponse.json({ error: "Failed to create coupon" }, { status: 500 });
  }
}
