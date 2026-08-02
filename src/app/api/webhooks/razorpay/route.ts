import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";

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
      if (invoice && invoice.status !== "PAID") {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: "PAID", razorpayPaymentId: payment.id, paidAt: new Date() },
        });
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
