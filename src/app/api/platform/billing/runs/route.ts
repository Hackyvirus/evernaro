import { NextResponse } from "next/server";
import { requirePlatformAdminId } from "@/lib/session";
import { runDailyBilling, runDunningReminders } from "@/lib/billing/billing-run";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const adminId = await requirePlatformAdminId();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const daily = await runDailyBilling();
    const dunning = await runDunningReminders();
    return NextResponse.json({ ok: true, daily, dunning });
  } catch (err) {
    console.error("Manual billing run failed:", err);
    return NextResponse.json({ error: "Billing run failed" }, { status: 500 });
  }
}

export async function GET() {
  const adminId = await requirePlatformAdminId();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const runs = await prisma.billingRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ runs });
}
