import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { createRazorpayOrder, isRazorpayConfigured } from "@/lib/razorpay";

const MIN_TOPUP_INR = 500;
const MAX_TOPUP_INR = 100000;

const bodySchema = z.object({
  amountInr: z.number().int().min(MIN_TOPUP_INR).max(MAX_TOPUP_INR),
});

// Self-serve WhatsApp wallet top-up, distinct from the platform-admin-only
// subscription invoice route — reuses the same Razorpay order flow, tagged
// with type: WALLET_TOPUP so the webhook/confirm handlers credit the wallet
// instead of just marking a recurring-fee invoice paid.
export async function POST(req: Request) {
  try {
    const { orgId } = await requireOrgMember(UserRole.ADMIN);
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: `Amount must be between ₹${MIN_TOPUP_INR} and ₹${MAX_TOPUP_INR}` },
        { status: 400 }
      );
    }
    const { amountInr } = parsed.data;

    if (!isRazorpayConfigured()) {
      return NextResponse.json({ error: "Payments aren't configured yet — contact support." }, { status: 503 });
    }

    const invoice = await prisma.invoice.create({
      data: { orgId, type: "WALLET_TOPUP", amountInr, status: "PENDING" },
    });

    try {
      const order = await createRazorpayOrder({ amountInr, receipt: invoice.id });
      const updated = await prisma.invoice.update({
        where: { id: invoice.id },
        data: { razorpayOrderId: order.id },
      });
      return NextResponse.json({ ok: true, invoice: updated });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Razorpay order creation failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to create top-up" }, { status: 500 });
  }
}
