import type { Channel, Contact } from "@prisma/client";
import { telegramSendMessage } from "@/lib/telegram";
import { sendEmail } from "@/lib/email";
import { gupshupSendMessage, gupshupSendTemplateMessage } from "@/lib/whatsapp";
import { instagramSendMessage } from "@/lib/instagram";
import { toGupshupFormat } from "@/lib/phone";
import { decryptSecret, decryptSecretOrNull } from "@/lib/crypto";

export interface WhatsAppTemplateSend {
  gupshupTemplateId: string;
  params: string[];
}

/**
 * Sends a message to a contact through whichever channel it belongs to.
 * Shared by manual agent replies, bulk campaigns, and reminders so all three
 * go through one code path per channel type. `whatsappTemplate`, when set,
 * sends a pre-approved template instead of free text — required for
 * WhatsApp sends outside Meta's 24-hour customer-service window (Campaigns
 * and Reminders always pass this; inbox replies never do).
 */
export async function sendViaChannel(
  channel: Channel,
  contact: Contact,
  text: string,
  subject?: string,
  whatsappTemplate?: WhatsAppTemplateSend
): Promise<void> {
  if (!channel.isActive) {
    throw new Error("This channel has been disconnected");
  }

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
    if (whatsappTemplate) {
      await gupshupSendTemplateMessage({
        apiKey: decryptSecret(channel.whatsappApiKey),
        sourceNumber: channel.whatsappSourceNumber,
        appName: channel.whatsappAppName,
        destination: toGupshupFormat(contact.phone),
        gupshupTemplateId: whatsappTemplate.gupshupTemplateId,
        params: whatsappTemplate.params,
      });
      return;
    }
    await gupshupSendMessage({
      apiKey: decryptSecret(channel.whatsappApiKey),
      sourceNumber: channel.whatsappSourceNumber,
      appName: channel.whatsappAppName,
      destination: toGupshupFormat(contact.phone),
      text,
    });
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
