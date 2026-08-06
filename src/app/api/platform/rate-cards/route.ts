import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdminId, UnauthorizedError } from "@/lib/session";

const upsertSchema = z.object({
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION", "SERVICE"]),
  countryCode: z.string().min(2).max(3).default("IN"),
  costPaise: z.number().int().min(0),
});

export async function GET() {
  try {
    await requirePlatformAdminId();
    const rateCards = await prisma.whatsAppRateCard.findMany({ orderBy: { category: "asc" } });
    return NextResponse.json(
      { rateCards },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
        },
      }
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load rate cards" }, { status: 500 });
  }
}

// Categories are a fixed enum, not user-created rows, so this is an upsert
// keyed on the (category, countryCode) natural key rather than a separate
// create/update-by-id pair.
export async function PUT(req: Request) {
  try {
    await requirePlatformAdminId();
    const parsed = upsertSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid rate card" }, { status: 400 });
    }
    const { category, countryCode, costPaise } = parsed.data;
    const rateCard = await prisma.whatsAppRateCard.upsert({
      where: { category_countryCode: { category, countryCode } },
      create: { category, countryCode, costPaise },
      update: { costPaise, effectiveFrom: new Date() },
    });
    return NextResponse.json({ ok: true, rateCard });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to update rate card" }, { status: 500 });
  }
}
