"server-only";
import { prisma } from "@/lib/prisma";
import type { Quote } from "./types";

export async function createInvoiceFromQuote(
  orgId: string,
  subscriptionId: string | null,
  quote: Quote,
  opts?: { status?: "PENDING"; dueDays?: number }
) {
  const status = opts?.status ?? "PENDING";

  const invoice = await prisma.invoice.create({
    data: {
      orgId,
      type: "SUBSCRIPTION",
      amountInr: quote.totalInr,
      status,
      subscriptionId,
      invoiceItems: {
        create: quote.lineItems.map((item) => ({
          orgId,
          type: item.type,
          description: item.description,
          quantity: item.quantity,
          unitPriceInr: item.unitPriceInr,
          amountInr: item.amountInr,
          metadata: {},
        })),
      },
    },
    include: { invoiceItems: true },
  });

  return invoice;
}

export async function markInvoicePaid(invoiceId: string, razorpayPaymentId?: string) {
  return prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "PAID", razorpayPaymentId, paidAt: new Date() },
  });
}

export async function getOrgInvoices(orgId: string) {
  return prisma.invoice.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    include: { invoiceItems: true },
  });
}
