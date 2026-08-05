import type { Channel, Contact, WalletReferenceType, WhatsAppTemplateCategory } from "@prisma/client";
import { telegramSendMessage } from "@/lib/telegram";
import { sendEmail } from "@/lib/email";
import { gupshupSendMessage, gupshupSendTemplateMessage } from "@/lib/whatsapp";
import { instagramSendMessage } from "@/lib/instagram";
import { toGupshupFormat } from "@/lib/phone";
import { decryptSecret, decryptSecretOrNull } from "@/lib/crypto";
import { chargeWhatsAppMessage, refundWhatsAppMessage } from "@/lib/whatsapp-wallet";
import { requireActiveSubscription } from "@/lib/subscription";

export interface WhatsAppTemplateSend {
  gupshupTemplateId: string;
  params: string[];
  category: WhatsAppTemplateCategory;
}

export interface WalletReference {
  type: WalletReferenceType;
  id: string;
}

// WhatsAppTemplateCategory (MARKETING/UTILITY, on WhatsAppTemplate) and
// WhatsAppMessageCategory (adds AUTHENTICATION/SERVICE, on the wallet's rate
// card) are distinct Prisma enum types even though the shared members are
// spelled the same — an explicit mapping avoids an unsafe cast between them.
function whatsappMessageCategoryFor(
  templateCategory?: WhatsAppTemplateCategory
): "MARKETING" | "UTILITY" | "SERVICE" {
  if (templateCategory === "MARKETING") return "MARKETING";
  if (templateCategory === "UTILITY") return "UTILITY";
  return "SERVICE"; // no template = free-text within the 24-hour customer-service window
}

/**
 * Sends a message to a contact through whichever channel it belongs to.
 * Shared by manual agent replies, bulk campaigns, and reminders so all three
 * go through one code path per channel type. `whatsappTemplate`, when set,
 * sends a pre-approved template instead of free text — required for
 * WhatsApp sends outside Meta's 24-hour customer-service window (Campaigns
 * and Reminders always pass this; inbox replies never do).
 *
 * `walletReference` identifies the specific send for wallet-debit
 * idempotency (a BullMQ stalled-job replay must not double-charge) — every
 * WhatsApp-sending caller must pass its own row id here.
 */
export async function sendViaChannel(
  channel: Channel,
  contact: Contact,
  text: string,
  subject?: string,
  whatsappTemplate?: WhatsAppTemplateSend,
  walletReference?: WalletReference
): Promise<void> {
  if (!channel.isActive) {
    throw new Error("This channel has been disconnected");
  }

  // Block all proactive sends from suspended or past-due organizations at the
  // single shared chokepoint. Manual inbox replies are also gated here so an
  // unpaid org cannot continue messaging through any channel.
  await requireActiveSubscription(channel.orgId);

  if (channel.type === "TELEGRAM") {
    if (!channel.telegramBotToken || !contact.telegramChatId) {
      throw new Error("Telegram channel not configured for this contact");
    }
    await telegramSendMessage(decryptSecret(channel.telegramBotToken), contact.telegramChatId, text);
    return;
  }

  if (channel.type === "EMAIL") {
    if (!channel.emailAddress || !contact.email) {
      throw new Error("Email channel not configured for this contact");
    }
    await sendEmail({
      apiKeyOverride: decryptSecretOrNull(channel.resendApiKey),
      from: `${channel.emailFromName ?? "EverReach"} <${channel.emailAddress}>`,
      to: contact.email,
      subject: subject ?? "Message from " + (channel.emailFromName ?? "EverReach"),
      text,
    });
    return;
  }

  if (channel.type === "WHATSAPP") {
    if (!channel.whatsappApiKey || !channel.whatsappSourceNumber || !channel.whatsappAppName || !contact.phone) {
      throw new Error("WhatsApp channel not configured for this contact");
    }

    const referenceType = walletReference?.type ?? "INBOX_MESSAGE";
    const referenceId = walletReference?.id ?? crypto.randomUUID();
    const category = whatsappMessageCategoryFor(whatsappTemplate?.category);
    const debit = await chargeWhatsAppMessage(channel.orgId, category, referenceType, referenceId);

    try {
      if (whatsappTemplate) {
        await gupshupSendTemplateMessage({
          apiKey: decryptSecret(channel.whatsappApiKey),
          sourceNumber: channel.whatsappSourceNumber,
          appName: channel.whatsappAppName,
          destination: toGupshupFormat(contact.phone),
          gupshupTemplateId: whatsappTemplate.gupshupTemplateId,
          params: whatsappTemplate.params,
        });
      } else {
        await gupshupSendMessage({
          apiKey: decryptSecret(channel.whatsappApiKey),
          sourceNumber: channel.whatsappSourceNumber,
          appName: channel.whatsappAppName,
          destination: toGupshupFormat(contact.phone),
          text,
        });
      }
    } catch (err) {
      await refundWhatsAppMessage(debit.walletId, debit.id, "Gupshup send failed").catch(() => {});
      throw err;
    }
    return;
  }

  if (channel.type === "INSTAGRAM") {
    if (!channel.instagramPageAccessToken || !contact.instagramUserId) {
      throw new Error("Instagram channel not configured for this contact");
    }
    await instagramSendMessage({
      pageAccessToken: decryptSecret(channel.instagramPageAccessToken),
      recipientId: contact.instagramUserId,
      text,
    });
    return;
  }

  throw new Error(`Unsupported channel type: ${channel.type}`);
}
