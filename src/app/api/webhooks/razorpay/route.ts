import { NextResponse } from "next/server";
import { InvoiceType, OrganizationStatus, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";
import { creditWallet } from "@/lib/whatsapp-wallet";
import { sendPaymentSuccessEmail, sendPaymentFailedEmail } from "@/lib/billing-email";
import { getPeriodDates } from "@/lib/billing/pricing-engine";
import { logBillingEvent } from "@/lib/billing/events";
import { recordSubscriptionPayment } from "@/lib/billing/subscription-service";

interface RazorpayWebhookPaymentEntity {
  id?: string;
  order_id?: string;
  subscription_id?: string;
  status?: string;
}

interface RazorpayWebhookPayload {
  event: string;
  payload?: {
    payment?: { entity?: RazorpayWebhookPaymentEntity };
    subscription?: {
      entity?: {
        id?: string;
        status?: "created" | "authenticated" | "active" | "pending" | "halted" | "cancelled" | "paused" | "resumed";
        current_start?: number;
        current_end?: number;
      };
    };
  };
}

async function billingContactForOrg(orgId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
  const owner = await prisma.user.findFirst({
    where: { orgId, role: "OWNER" },
    select: { email: true },
  });
  if (!org || !owner) return null;
  return { orgName: org.name, email: owner.email };
}

function mapRazorpayStatus(status?: string): SubscriptionStatus | null {
  switch (status) {
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "halted":
    case "pending":
      return SubscriptionStatus.PAST_DUE;
    case "cancelled":
      return SubscriptionStatus.CANCELLED;
    case "paused":
      return SubscriptionStatus.PAUSED;
    case "created":
    case "authenticated":
    default:
      return null;
  }
}

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
        const wasAlreadyPaid = invoice.status === "PAID";
        if (!wasAlreadyPaid) {
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { status: "PAID", razorpayPaymentId: payment.id, paidAt: new Date() },
          });
        }
        if (invoice.type === InvoiceType.SUBSCRIPTION) {
          await prisma.organization.update({
            where: { id: invoice.orgId },
            data: { status: OrganizationStatus.ACTIVE },
          });
          if (invoice.subscriptionId) {
            await prisma.customerSubscription.updateMany({
              where: { id: invoice.subscriptionId },
              data: { status: SubscriptionStatus.ACTIVE },
            });
          }
        }
        if (invoice.type === InvoiceType.WALLET_TOPUP) {
          await creditWallet(invoice.orgId, invoice.amountInr * 100, "TOPUP", { invoiceId: invoice.id });
        }
        await recordSubscriptionPayment({
          orgId: invoice.orgId,
          invoiceId: invoice.id,
          subscriptionId: invoice.subscriptionId ?? undefined,
          amountInr: invoice.amountInr,
          razorpayPaymentId: payment.id,
          razorpayOrderId: payment.order_id,
          status: "PAID",
          metadata: { source: "webhook", event: body.event },
        }).catch((err) => console.error("Failed to record payment:", err));
        if (!wasAlreadyPaid) {
          const contact = await billingContactForOrg(invoice.orgId);
          if (contact) {
            try {
              await sendPaymentSuccessEmail(contact.email, contact.orgName, invoice.id, invoice.amountInr, payment.id);
            } catch (err) {
              console.error("Failed to send payment success email:", err);
            }
          }
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
        await recordSubscriptionPayment({
          orgId: invoice.orgId,
          invoiceId: invoice.id,
          subscriptionId: invoice.subscriptionId ?? undefined,
          amountInr: invoice.amountInr,
          razorpayPaymentId: payment.id,
          razorpayOrderId: payment.order_id,
          status: "FAILED",
          metadata: { source: "webhook", event: body.event },
        }).catch((err) => console.error("Failed to record failed payment:", err));
        const contact = await billingContactForOrg(invoice.orgId);
        if (contact) {
          try {
            await sendPaymentFailedEmail(contact.email, contact.orgName, invoice.id, invoice.amountInr);
          } catch (err) {
            console.error("Failed to send payment failed email:", err);
          }
        }
      }
    }
  }

  if (body.event === "subscription.activated" || body.event === "subscription.charged" || body.event === "subscription.updated") {
    const entity = body.payload?.subscription?.entity;
    if (entity?.id) {
      const subscription = await prisma.customerSubscription.findFirst({
        where: { razorpaySubscriptionId: entity.id },
      });
      if (subscription) {
        const status = mapRazorpayStatus(entity.status);
        const update: Record<string, unknown> = {};
        if (status) update.status = status;
        if (entity.current_start && entity.current_end) {
          const { start, end } = getPeriodDates(subscription.frequency, new Date(entity.current_start * 1000));
          update.currentPeriodStart = start;
          update.currentPeriodEnd = end;
        }
        if (Object.keys(update).length > 0) {
          await prisma.customerSubscription.update({ where: { id: subscription.id }, data: update });
        }
        await logBillingEvent(subscription.orgId, subscription.id, body.event.toUpperCase(), {
          razorpayStatus: entity.status,
        });
      }
    }
  }

  if (body.event === "subscription.payment.failed" || body.event === "subscription.pending" || body.event === "subscription.halted") {
    const entity = body.payload?.subscription?.entity;
    if (entity?.id) {
      const subscription = await prisma.customerSubscription.findFirst({
        where: { razorpaySubscriptionId: entity.id },
      });
      if (subscription) {
        const status = body.event === "subscription.halted" ? SubscriptionStatus.PAYMENT_FAILED : SubscriptionStatus.PAST_DUE;
        await prisma.customerSubscription.update({
          where: { id: subscription.id },
          data: { status },
        });
        await logBillingEvent(subscription.orgId, subscription.id, body.event.toUpperCase(), {
          razorpayStatus: entity.status,
        });
      }
    }
  }

  if (body.event === "subscription.cancelled" || body.event === "subscription.halted") {
    const entity = body.payload?.subscription?.entity;
    if (entity?.id) {
      const subscription = await prisma.customerSubscription.findFirst({
        where: { razorpaySubscriptionId: entity.id },
      });
      if (subscription) {
        const status = mapRazorpayStatus(entity.status);
        await prisma.customerSubscription.update({
          where: { id: subscription.id },
          data: { status: status ?? SubscriptionStatus.CANCELLED, cancelledAt: new Date() },
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
