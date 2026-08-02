import { channelWebhookSecret } from "@/lib/webhook-secret";

const TELEGRAM_API = "https://api.telegram.org";

export const telegramWebhookSecret = channelWebhookSecret;

export async function telegramSetWebhook(botToken: string, channelId: string) {
  const url = `${process.env.NEXT_PUBLIC_BASE_URL}/api/telegram/webhook/${channelId}`;
  const res = await fetch(`${TELEGRAM_API}/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      secret_token: telegramWebhookSecret(channelId),
      allowed_updates: ["message"],
    }),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.description ?? "Failed to set Telegram webhook");
  }
  return data;
}

export async function telegramGetMe(botToken: string) {
  const res = await fetch(`${TELEGRAM_API}/bot${botToken}/getMe`);
  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.description ?? "Invalid Telegram bot token");
  }
  return data.result as { id: number; username: string; first_name: string };
}

export async function telegramSendMessage(botToken: string, chatId: string, text: string) {
  const res = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.description ?? "Failed to send Telegram message");
  }
  return data.result;
}

export interface TelegramUpdate {
  message?: {
    message_id: number;
    chat: { id: number };
    from?: { id: number; first_name?: string; username?: string };
    text?: string;
    date: number;
  };
}
