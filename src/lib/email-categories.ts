import { sendEmail } from "@/lib/email";
import { EMAIL_SENDERS, type EmailCategory } from "@/lib/email-senders";

type SendArgs = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string | string[];
};

function sendForCategory(category: EmailCategory) {
  return async function ({ to, subject, text, replyTo }: SendArgs) {
    const sender = EMAIL_SENDERS[category];
    await sendEmail({
      from: sender.from,
      replyTo: replyTo ?? sender.replyTo,
      to,
      subject,
      text,
    });
  };
}

export const sendAuthEmail = sendForCategory("auth");
export const sendBillingEmail = sendForCategory("billing");
export const sendSupportEmail = sendForCategory("support");
export const sendContactEmail = sendForCategory("contact");
export const sendNotificationEmail = sendForCategory("notifications");
export const sendSecurityEmail = sendForCategory("security");
export const sendMarketingEmail = sendForCategory("marketing");
