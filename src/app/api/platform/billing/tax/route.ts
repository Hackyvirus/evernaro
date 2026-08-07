import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdminId, UnauthorizedError } from "@/lib/session";

export async function GET() {
  try {
    await requirePlatformAdminId();
    const config = await prisma.taxConfiguration.findFirst({ where: { enabled: true } });
    return NextResponse.json({ config });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load tax config" }, { status: 500 });
  }
}

const bodySchema = z.object({
  name: z.string().min(1),
  rate: z.number().min(0).max(100),
  inclusive: z.boolean().default(false),
});

export async function PATCH(req: Request) {
  try {
    await requirePlatformAdminId();
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    await prisma.taxConfiguration.updateMany({ data: { enabled: false } });
    const config = await prisma.taxConfiguration.upsert({
      where: { id: "default_tax" },
      update: { ...parsed.data, enabled: true },
      create: { id: "default_tax", ...parsed.data, enabled: true },
    });

    return NextResponse.json({ config });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to update tax config:", err);
    return NextResponse.json({ error: "Failed to update tax config" }, { status: 500 });
  }
}
