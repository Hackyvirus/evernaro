"server-only";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";

function rupee(amountInr: number) {
  return `₹${amountInr.toLocaleString("en-IN")}`;
}

export async function generateInvoicePdf(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { org: true, invoiceItems: true, subscription: { include: { plan: true } } },
  });
  if (!invoice) throw new Error("Invoice not found");

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).text("Evernaro Invoice", { align: "left" });
    doc.fontSize(10).text(`Invoice ID: ${invoice.id}`);
    doc.text(`Status: ${invoice.status}`);
    doc.text(`Date: ${invoice.createdAt.toLocaleDateString()}`);
    if (invoice.paidAt) doc.text(`Paid on: ${invoice.paidAt.toLocaleDateString()}`);
    doc.moveDown();

    doc.fontSize(12).text(`Billed to: ${invoice.org.name}`);
    doc.moveDown();

    doc.fontSize(12).text("Items", { underline: true });
    invoice.invoiceItems.forEach((item) => {
      doc.fontSize(10).text(`${item.description} x ${item.quantity} — ${rupee(item.amountInr)}`);
    });
    doc.moveDown();
    doc.fontSize(14).text(`Total: ${rupee(invoice.amountInr)}`, { align: "right" });

    if (invoice.subscription?.plan) {
      doc.moveDown();
      doc.fontSize(10).text(`Plan: ${invoice.subscription.plan.name}`);
    }

    doc.end();
  });
}

export async function generateReceiptPdf(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { org: true, invoice: true },
  });
  if (!payment) throw new Error("Payment not found");

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).text("Payment Receipt", { align: "left" });
    doc.fontSize(10).text(`Receipt ID: ${payment.id}`);
    doc.text(`Date: ${payment.createdAt.toLocaleDateString()}`);
    doc.text(`Amount: ${rupee(payment.amountInr)}`);
    doc.text(`Status: ${payment.status}`);
    if (payment.razorpayPaymentId) doc.text(`Razorpay Payment ID: ${payment.razorpayPaymentId}`);
    doc.moveDown();
    doc.fontSize(12).text(`Paid by: ${payment.org.name}`);
    if (payment.invoice) {
      doc.text(`For invoice: ${payment.invoice.id}`);
    }
    doc.end();
  });
}
