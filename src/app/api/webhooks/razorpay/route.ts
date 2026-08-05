import { NextResponse } from "next/server";
import { InvoiceType, OrganizationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";
import { creditWallet } from "@/lib/whatsapp-wallet";

interface RazorpayWebhookPayload {
  event: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        status?: string;
      };
    };
  };
}

// Server-to-server confirmation, independent of whether the paying browser
// ever reports back — the durable source of truth for invoice status.
// Configure this URL + a webhook secret in the Razorpay dashboard under
// Settings > Webhooks, subscribed to "payment.captured".
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: RazorpayWebhookPayload;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.event === "payment.captured") {
    const payment = body.payload?.payment?.entity;
    if (payment?.order_id && payment.id) {
      const invoice = await prisma.invoice.findUnique({ where: { razorpayOrderId: payment.order_id } });
      if (invoice) {
        if (invoice.status !== "PAID") {
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { status: "PAID", razorpayPaymentId: payment.id, paidAt: new Date() },
          });
        }
        // Subscription payment reactivates the organization.
        if (invoice.type === InvoiceType.SUBSCRIPTION) {
          await prisma.organization.update({
            where: { id: invoice.orgId },
            data: { status: OrganizationStatus.ACTIVE },
          });
        }
        // Razorpay retries webhook delivery and the client-side confirm route
        // can also fire for the same invoice — creditWallet is idempotent per
        // invoiceId regardless of which path reaches PAID first or twice.
        if (invoice.type === InvoiceType.WALLET_TOPUP) {
          await creditWallet(invoice.orgId, invoice.amountInr * 100, "TOPUP", { invoiceId: invoice.id });
        }
      }
    }
  }

  if (body.event === "payment.failed") {
    const payment = body.payload?.payment?.entity;
    if (payment?.order_id) {
      const invoice = await prisma.invoice.findUnique({ where: { razorpayOrderId: payment.order_id } });
      if (invoice && invoice.status === "PENDING") {
        await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "FAILED" } });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
