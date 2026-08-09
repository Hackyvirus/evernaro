import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { InvoiceStatus, InvoiceType, OrganizationStatus, SubscriptionStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";
import { creditWallet } from "@/lib/whatsapp-wallet";
import { sendPaymentSuccessEmail, sendPaymentFailedEmail } from "@/lib/billing-email";
import { logBillingEvent } from "@/lib/billing/events";
import { recordSubscriptionPayment, finalizePlanChange } from "@/lib/billing/subscription-service";
import {
  recordSubscriptionPaymentFailure,
  applySubscriptionPayment,
} from "@/lib/billing/billing-run";
import { syncOrganizationStatusFromSubscription } from "@/lib/billing/subscription-status";
import { syncPaymentMethods } from "@/lib/billing/payment-methods";

interface RazorpayWebhookPaymentEntity {
  id?: string;
  order_id?: string;
  subscription_id?: string;
  status?: string;
  amount?: number;
  error_code?: string;
  error_description?: string;
}

interface RazorpayWebhookPayload {
  id?: string;
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

interface RazorpayWebhookSubscriptionChargedPayload {
  event: "subscription.charged";
  payload?: {
    subscription?: { entity?: { id?: string; status?: string; current_start?: number; current_end?: number } };
    payment?: { entity?: { id?: string; order_id?: string; amount?: number; status?: string } };
  };
}

function eventLockKey(eventId: string): bigint {
  const hash = crypto.createHash("sha256").update(eventId).digest("hex");
  return BigInt.asIntN(64, BigInt("0x" + hash.slice(0, 16)));
}

function paymentAmountMatches(invoice: { amountInr: number }, amountPaise?: number): boolean {
  if (amountPaise == null) return false;
  return amountPaise === invoice.amountInr * 100;
}

async function billingContactForOrg(tx: Prisma.TransactionClient, orgId: string) {
  const org = await tx.organization.findUnique({ where: { id: orgId }, select: { name: true } });
  const owner = await tx.user.findFirst({ where: { orgId, role: "OWNER" }, select: { email: true } });
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

  if (!body.id) {
    return NextResponse.json({ ok: true });
  }
  const eventId = body.id;

  const lock = eventLockKey(eventId);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${lock})`;

      const existing = await tx.razorpayWebhookEvent.findUnique({
        where: { eventId },
        select: { id: true },
      });
      if (existing) return;

      if (body.event === "payment.captured") {
        const payment = body.payload?.payment?.entity;
        if (!payment?.order_id || !payment.id) return;

        const invoice = await tx.invoice.findUnique({
          where: { razorpayOrderId: payment.order_id },
        });
        if (!invoice) return;

        if (!paymentAmountMatches(invoice, payment.amount)) {
          await logBillingEvent(
            invoice.orgId,
            invoice.subscriptionId ?? null,
            "PAYMENT_AMOUNT_MISMATCH",
            {
              invoiceId: invoice.id,
              expectedPaise: invoice.amountInr * 100,
              receivedPaise: payment.amount,
            },
            tx
          );
          await tx.razorpayWebhookEvent.create({
            data: {
              eventId,
              eventType: body.event,
              orgId: invoice.orgId,
              payload: body as unknown as Prisma.InputJsonValue,
            },
          });
          return;
        }

        const wasAlreadyPaid = invoice.status === InvoiceStatus.PAID;

        if (payment.amount == null) return;

        if (invoice.type === InvoiceType.SUBSCRIPTION && invoice.subscriptionId) {
          // applySubscriptionPayment verifies the amount, marks the invoice paid,
          // handles first-payment plan activation, and advances the period once.
          const result = await applySubscriptionPayment(
            invoice.subscriptionId,
            { id: payment.id, amount: payment.amount, order_id: payment.order_id },
            { eventType: body.event, eventId, tx }
          );
          if (!result.invoice) return;
        } else {
          if (!wasAlreadyPaid) {
            await tx.invoice.update({
              where: { id: invoice.id },
              data: { status: InvoiceStatus.PAID, razorpayPaymentId: payment.id, paidAt: new Date() },
            });
          }

          if (invoice.type === InvoiceType.WALLET_TOPUP) {
            await creditWallet(invoice.orgId, invoice.amountInr * 100, "TOPUP", { invoiceId: invoice.id }, tx);
            await tx.organization.update({
              where: { id: invoice.orgId },
              data: { status: OrganizationStatus.ACTIVE },
            });
            await logBillingEvent(
              invoice.orgId,
              null,
              "WALLET_TOPUP_PAID",
              { invoiceId: invoice.id, amountInr: invoice.amountInr },
              tx
            );
          }

          await recordSubscriptionPayment(
            {
              orgId: invoice.orgId,
              invoiceId: invoice.id,
              subscriptionId: invoice.subscriptionId ?? undefined,
              amountInr: invoice.amountInr,
              razorpayPaymentId: payment.id,
              razorpayOrderId: payment.order_id,
              status: "PAID",
              metadata: { source: "webhook", event: body.event },
            },
            tx
          );
        }

        if (!wasAlreadyPaid) {
          const contact = await billingContactForOrg(tx, invoice.orgId);
          if (contact) {
            try {
              await sendPaymentSuccessEmail(contact.email, contact.orgName, invoice.id, invoice.amountInr, payment.id);
            } catch (err) {
              console.error("Failed to send payment success email:", err);
            }
          }
        }

        await tx.razorpayWebhookEvent.create({
          data: {
            eventId,
            eventType: body.event,
            orgId: invoice.orgId,
            payload: body as unknown as Prisma.InputJsonValue,
          },
        });
        return;
      }

      if (body.event === "payment.failed") {
        const payment = body.payload?.payment?.entity;
        if (!payment?.order_id) return;

        const invoice = await tx.invoice.findUnique({
          where: { razorpayOrderId: payment.order_id },
        });
        if (!invoice || invoice.status !== InvoiceStatus.PENDING) return;

        await tx.invoice.update({ where: { id: invoice.id }, data: { status: InvoiceStatus.FAILED } });
        await recordSubscriptionPayment(
          {
            orgId: invoice.orgId,
            invoiceId: invoice.id,
            subscriptionId: invoice.subscriptionId ?? undefined,
            amountInr: invoice.amountInr,
            razorpayPaymentId: payment.id,
            razorpayOrderId: payment.order_id,
            status: "FAILED",
            failureReason: payment.error_description || payment.error_code || "Payment failed",
            metadata: { source: "webhook", event: body.event },
          },
          tx
        );
        if (invoice.subscriptionId) {
          await syncOrganizationStatusFromSubscription(invoice.orgId, tx);
        }

        const contact = await billingContactForOrg(tx, invoice.orgId);
        if (contact) {
          try {
            await sendPaymentFailedEmail(contact.email, contact.orgName, invoice.id, invoice.amountInr);
          } catch (err) {
            console.error("Failed to send payment failed email:", err);
          }
        }

        await tx.razorpayWebhookEvent.create({
          data: {
            eventId,
            eventType: body.event,
            orgId: invoice.orgId,
            payload: body as unknown as Prisma.InputJsonValue,
          },
        });
        return;
      }

      if (body.event === "subscription.activated" || body.event === "subscription.charged" || body.event === "subscription.updated") {
        const entity = body.payload?.subscription?.entity;
        if (!entity?.id) return;

        const subscription = await tx.customerSubscription.findFirst({
          where: { razorpaySubscriptionId: entity.id },
        });
        if (!subscription) return;

        const needsFinalize =
          (subscription.status === SubscriptionStatus.INCOMPLETE || subscription.status === SubscriptionStatus.TRIALING) &&
          (body.event === "subscription.activated" || body.event === "subscription.charged");
        if (needsFinalize) {
          await finalizePlanChange(subscription.orgId, subscription.id, tx);
        }

        const status = mapRazorpayStatus(entity.status);
        const update: Record<string, unknown> = {};
        if (status) update.status = status;
        if (entity.current_start && entity.current_end) {
          update.currentPeriodStart = new Date(entity.current_start * 1000);
          update.currentPeriodEnd = new Date(entity.current_end * 1000);
        }
        if (Object.keys(update).length > 0) {
          await tx.customerSubscription.update({ where: { id: subscription.id }, data: update });
          await syncOrganizationStatusFromSubscription(subscription.orgId, tx);
        }

        if (body.event === "subscription.charged") {
          const payment = (body as RazorpayWebhookSubscriptionChargedPayload).payload?.payment?.entity;
          if (payment?.id && payment.amount != null) {
            // Razorpay already advances the subscription period in this event's
            // entity, so we only mark the invoice paid and do not advance locally.
            await applySubscriptionPayment(
              subscription.id,
              { id: payment.id, amount: payment.amount, order_id: payment.order_id },
              { eventType: body.event, eventId, tx, advancePeriod: false }
            );
          }
        }

        await logBillingEvent(subscription.orgId, subscription.id, body.event.toUpperCase(), {
          razorpayStatus: entity.status,
        }, tx);

        await tx.razorpayWebhookEvent.create({
          data: {
            eventId,
            eventType: body.event,
            orgId: subscription.orgId,
            payload: body as unknown as Prisma.InputJsonValue,
          },
        });
        return;
      }

      if (body.event === "subscription.payment.failed" || body.event === "subscription.pending") {
        const entity = body.payload?.subscription?.entity;
        if (!entity?.id) return;

        const subscription = await tx.customerSubscription.findFirst({
          where: { razorpaySubscriptionId: entity.id },
        });
        if (!subscription) return;

        await tx.customerSubscription.update({
          where: { id: subscription.id },
          data: { status: SubscriptionStatus.PAST_DUE },
        });
        await syncOrganizationStatusFromSubscription(subscription.orgId, tx);
        if (body.event === "subscription.payment.failed") {
          await recordSubscriptionPaymentFailure(subscription.id, `Razorpay event: ${body.event}`, tx, eventId);
        }
        await logBillingEvent(subscription.orgId, subscription.id, body.event.toUpperCase(), {
          razorpayStatus: entity.status,
        }, tx);

        await tx.razorpayWebhookEvent.create({
          data: {
            eventId,
            eventType: body.event,
            orgId: subscription.orgId,
            payload: body as unknown as Prisma.InputJsonValue,
          },
        });
        return;
      }

      if (body.event === "subscription.halted") {
        const entity = body.payload?.subscription?.entity;
        if (!entity?.id) return;

        const subscription = await tx.customerSubscription.findFirst({
          where: { razorpaySubscriptionId: entity.id },
        });
        if (!subscription) return;

        await tx.customerSubscription.update({
          where: { id: subscription.id },
          data: { status: SubscriptionStatus.PAYMENT_FAILED },
        });
        await syncOrganizationStatusFromSubscription(subscription.orgId, tx);
        await recordSubscriptionPaymentFailure(subscription.id, `Razorpay event: ${body.event}`, tx, eventId);
        await logBillingEvent(subscription.orgId, subscription.id, body.event.toUpperCase(), {
          razorpayStatus: entity.status,
        }, tx);

        await tx.razorpayWebhookEvent.create({
          data: {
            eventId,
            eventType: body.event,
            orgId: subscription.orgId,
            payload: body as unknown as Prisma.InputJsonValue,
          },
        });
        return;
      }

      if (body.event === "subscription.cancelled") {
        const entity = body.payload?.subscription?.entity;
        if (!entity?.id) return;

        const subscription = await tx.customerSubscription.findFirst({
          where: { razorpaySubscriptionId: entity.id },
        });
        if (!subscription) return;

        const status = mapRazorpayStatus(entity.status);
        await tx.customerSubscription.update({
          where: { id: subscription.id },
          data: { status: status ?? SubscriptionStatus.CANCELLED, cancelledAt: new Date() },
        });
        await syncOrganizationStatusFromSubscription(subscription.orgId, tx);

        await tx.razorpayWebhookEvent.create({
          data: {
            eventId,
            eventType: body.event,
            orgId: subscription.orgId,
            payload: body as unknown as Prisma.InputJsonValue,
          },
        });
      }
    });

    if (body.event === "payment.captured") {
      const payment = body.payload?.payment?.entity;
      if (payment?.order_id) {
        const invoice = await prisma.invoice.findUnique({ where: { razorpayOrderId: payment.order_id } });
        if (invoice) {
          syncPaymentMethods(invoice.orgId).catch((err) => console.error("Failed to sync payment methods:", err));
        }
      }
    }
  } catch (err) {
    console.error("Razorpay webhook error:", err);
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
