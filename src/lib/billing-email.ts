import { sendBillingEmail } from "@/lib/email-categories";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export async function sendInvoiceCreatedEmail(
  email: string,
  orgName: string,
  invoiceId: string,
  amountInr: number
) {
  const url = `${BASE_URL}/billing`;
  await sendBillingEmail({
    to: email,
    subject: `${orgName}: invoice for ₹${amountInr}`,
    text: `Hi,\n\nA new invoice for ${orgName} is ready for payment.\n\nAmount: ₹${amountInr}\nInvoice ID: ${invoiceId}\n\nView and pay the invoice in your Evernaro Billing page:\n${url}\n\nQuestions? Reply to this email or contact support@evernaro.com.`,
  });
}

export async function sendPaymentSuccessEmail(
  email: string,
  orgName: string,
  invoiceId: string,
  amountInr: number,
  paymentId?: string | null
) {
  await sendBillingEmail({
    to: email,
    subject: `${orgName}: payment received`,
    text: `Hi,\n\nWe received your payment of ₹${amountInr} for ${orgName}.\n\nInvoice ID: ${invoiceId}${paymentId ? `\nPayment ID: ${paymentId}` : ""}\n\nThank you for using Evernaro. Your receipt is available in your Billing page:\n${BASE_URL}/billing\n\nQuestions? Reply to this email or contact support@evernaro.com.`,
  });
}

export async function sendPaymentFailedEmail(
  email: string,
  orgName: string,
  invoiceId: string,
  amountInr: number
) {
  const url = `${BASE_URL}/billing`;
  await sendBillingEmail({
    to: email,
    subject: `${orgName}: payment failed`,
    text: `Hi,\n\nYour payment of ₹${amountInr} for ${orgName} could not be processed.\n\nInvoice ID: ${invoiceId}\n\nPlease check your payment method and try again from your Billing page:\n${url}\n\nNeed help? Reply to this email or contact support@evernaro.com.`,
  });
}
