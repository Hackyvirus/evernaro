// Instagram Messaging via the Meta Graph API (the IG professional account's
// linked Facebook Page). Requires a Meta App with instagram_manage_messages
// permission and app review — see https://developers.facebook.com/docs/messenger-platform/instagram

const GRAPH_API_VERSION = "v21.0";

export async function instagramSendMessage(opts: {
  pageAccessToken: string;
  recipientId: string; // Instagram-scoped user ID (IGSID)
  text: string;
}) {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages?access_token=${encodeURIComponent(opts.pageAccessToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: opts.recipientId },
        message: { text: opts.text },
        messaging_type: "RESPONSE",
      }),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Instagram send failed (${res.status})`);
  }
  return data;
}

export interface InstagramWebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    time?: number;
    messaging?: Array<{
      sender?: { id?: string };
      recipient?: { id?: string };
      timestamp?: number;
      message?: { mid?: string; text?: string; is_echo?: boolean };
    }>;
  }>;
}

export interface InstagramInboundMessage {
  from: string;
  text: string;
  mid?: string;
}

// Meta batches multiple message events (even across different conversations)
// into a single webhook delivery under normal, non-malicious conditions —
// return all of them, not just the first, or later messages in the batch are
// silently dropped.
export function parseInstagramInboundBatch(body: InstagramWebhookPayload): InstagramInboundMessage[] {
  if (body.object !== "instagram") return [];
  const messages: InstagramInboundMessage[] = [];
  for (const entry of body.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      const text = event.message?.text;
      const from = event.sender?.id;
      const mid = event.message?.mid;
      // is_echo events are messages the business itself sent — ignore to avoid loops.
      if (text && from && !event.message?.is_echo) {
        messages.push({ from, text, mid });
      }
    }
  }
  return messages;
}
