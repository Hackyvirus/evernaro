import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgId, UnauthorizedError } from "@/lib/session";
import { verifyRazorpayPaymentSignature } from "@/lib/razorpay";

const bodySchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

// Fast-path confirmation called by the browser right after Razorpay
// Checkout reports success. The webhook (/api/webhooks/razorpay) is the
// durable source of truth — this just gives the org owner immediate
// feedback instead of waiting on the webhook round-trip.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = await requireOrgId();
    const { id } = await params;
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid confirmation payload" }, { status: 400 });
    }
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.data;

    const invoice = await prisma.invoice.findFirst({ where: { id, orgId } });
    if (!invoice || invoice.razorpayOrderId !== razorpayOrderId) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const valid = verifyRazorpayPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature });
    if (!valid) {
      return NextResponse.json({ error: "Payment signature verification failed" }, { status: 400 });
    }

    if (invoice.status !== "PAID") {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: "PAID", razorpayPaymentId, paidAt: new Date() },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 });
  }
}
