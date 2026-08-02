import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdminId, UnauthorizedError } from "@/lib/session";

const bodySchema = z.object({
  monthlyFeeInr: z.number().int().nonnegative().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePlatformAdminId();
    const { id } = await params;

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const org = await prisma.organization.update({
      where: { id },
      data: { monthlyFeeInr: parsed.data.monthlyFeeInr },
    });

    return NextResponse.json({ ok: true, monthlyFeeInr: org.monthlyFeeInr });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to update client" }, { status: 500 });
  }
}
