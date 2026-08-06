import { NextResponse } from "next/server";
import { z } from "zod";
import { InvoiceType, OrganizationStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { verifyRazorpayPaymentSignature } from "@/lib/razorpay";
import { creditWallet } from "@/lib/whatsapp-wallet";
import { sendPaymentSuccessEmail } from "@/lib/billing-email";

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

    if (invoice.status !== "PAID") {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: "PAID", razorpayPaymentId, paidAt: new Date() },
      });
    }

    // Subscription payment reactivates the organization.
    if (invoice.type === InvoiceType.SUBSCRIPTION) {
      await prisma.organization.update({
        where: { id: orgId },
        data: { status: OrganizationStatus.ACTIVE },
      });
    }

    // Idempotent regardless of whether the webhook already handled this —
    // creditWallet no-ops on a second call for the same invoiceId.
    if (invoice.type === InvoiceType.WALLET_TOPUP) {
      await creditWallet(invoice.orgId, invoice.amountInr * 100, "TOPUP", { invoiceId: invoice.id });
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
