import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdminId, UnauthorizedError } from "@/lib/session";
import { createRazorpayOrder, isRazorpayConfigured } from "@/lib/razorpay";

const bodySchema = z.object({
  amountInr: z.number().int().positive().optional(), // defaults to the org's monthlyFeeInr
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdminId();
    const { id } = await params;
    const invoices = await prisma.invoice.findMany({
      where: { orgId: id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ invoices });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load invoices" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdminId();
    const { id } = await params;
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const amountInr = parsed.data.amountInr ?? org.monthlyFeeInr;
    if (!amountInr || amountInr <= 0) {
      return NextResponse.json(
        { error: "Set a monthly fee for this client first, or pass an amount." },
        { status: 400 }
      );
    }

    const invoice = await prisma.invoice.create({
      data: { orgId: id, amountInr, status: "PENDING" },
    });

    if (!isRazorpayConfigured()) {
      return NextResponse.json({
        ok: true,
        invoice,
        warning: "Razorpay isn't configured yet (RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET) — invoice saved, but the client can't pay it online until that's set.",
      });
    }

    try {
      const order = await createRazorpayOrder({ amountInr, receipt: invoice.id });
      const updated = await prisma.invoice.update({
        where: { id: invoice.id },
        data: { razorpayOrderId: order.id },
      });
      return NextResponse.json({ ok: true, invoice: updated });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Razorpay order creation failed";
      return NextResponse.json({ ok: true, invoice, warning: message });
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 });
  }
}
