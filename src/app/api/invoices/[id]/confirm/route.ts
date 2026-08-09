import { NextResponse } from "next/server";
import { z } from "zod";
import { InvoiceStatus, InvoiceType, OrganizationStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { verifyRazorpayPaymentSignature, fetchRazorpayPayment } from "@/lib/razorpay";
import { creditWallet } from "@/lib/whatsapp-wallet";
import { sendPaymentSuccessEmail } from "@/lib/billing-email";
import { recordSubscriptionPayment } from "@/lib/billing/subscription-service";
import { applySubscriptionPayment } from "@/lib/billing/billing-run";

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
    const { orgId } = await requireOrgMember(UserRole.ADMIN);
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

    let capturedAmountPaise: number | undefined;
    try {
      const payment = await fetchRazorpayPayment(razorpayPaymentId);
      capturedAmountPaise = payment.amount;
      if (payment.order_id && payment.order_id !== razorpayOrderId) {
        return NextResponse.json({ error: "Payment does not belong to this invoice order" }, { status: 400 });
      }
      if (payment.status !== "captured") {
        return NextResponse.json({ error: "Payment has not been captured" }, { status: 400 });
      }
    } catch (err) {
      console.error("Failed to fetch Razorpay payment for confirmation:", err);
      return NextResponse.json({ error: "Unable to verify payment amount" }, { status: 502 });
    }

    if (capturedAmountPaise == null || capturedAmountPaise !== invoice.amountInr * 100) {
      return NextResponse.json(
        { error: "Payment amount does not match invoice amount" },
        { status: 400 }
      );
    }

    const wasAlreadyPaid = invoice.status === InvoiceStatus.PAID;
    if (!wasAlreadyPaid) {
      await prisma.invoice.update({
        where: { id, orgId },
        data: { status: InvoiceStatus.PAID, razorpayPaymentId, paidAt: new Date() },
      });
    }

    if (invoice.type === InvoiceType.SUBSCRIPTION && invoice.subscriptionId) {
      await applySubscriptionPayment(
        invoice.subscriptionId,
        { id: razorpayPaymentId, amount: capturedAmountPaise, order_id: razorpayOrderId },
        { eventType: "browser_confirmation" }
      );
    } else {
      await recordSubscriptionPayment({
        orgId: invoice.orgId,
        invoiceId: invoice.id,
        subscriptionId: invoice.subscriptionId ?? undefined,
        amountInr: invoice.amountInr,
        razorpayPaymentId,
        razorpayOrderId,
        status: "PAID",
        metadata: { source: "browser_confirmation" },
      }).catch((err) => console.error("Failed to record payment:", err));
    }

    // Idempotent regardless of whether the webhook already handled this —
    // creditWallet no-ops on a second call for the same invoiceId.
    if (invoice.type === InvoiceType.WALLET_TOPUP) {
      await creditWallet(invoice.orgId, invoice.amountInr * 100, "TOPUP", { invoiceId: invoice.id });
      await prisma.organization.update({
        where: { id: invoice.orgId },
        data: { status: OrganizationStatus.ACTIVE },
      });
    }

    // Best-effort receipt email. The webhook path also sends this, so this
    // handles the case where the browser returns faster than the webhook.
    const owner = await prisma.user.findFirst({
      where: { orgId: invoice.orgId, role: "OWNER" },
      select: { email: true },
    });
    const org = await prisma.organization.findUnique({
      where: { id: invoice.orgId },
      select: { name: true },
    });
    if (owner && org) {
      try {
        await sendPaymentSuccessEmail(
          owner.email,
          org.name,
          invoice.id,
          invoice.amountInr,
          razorpayPaymentId
        );
      } catch (err) {
        console.error("Failed to send payment success email:", err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 });
  }
}
