import { NextResponse } from "next/server";
import { z } from "zod";
import { calculateQuote } from "@/lib/billing/pricing-engine";
import { requireOrgId, UnauthorizedError } from "@/lib/session";
import { BillingFrequency } from "@prisma/client";

const bodySchema = z.object({
  planId: z.string().cuid(),
  frequency: z.nativeEnum(BillingFrequency).optional(),
  addOns: z.array(z.object({ addOnId: z.string().cuid(), quantity: z.number().int().positive() })).optional(),
  couponCode: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const orgId = await requireOrgId();
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const quote = await calculateQuote({ ...parsed.data, orgId });
    return NextResponse.json({ quote });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to calculate quote" }, { status: 500 });
  }
}
