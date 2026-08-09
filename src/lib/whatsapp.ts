// WhatsApp via Gupshup (BSP) — https://docs.gupshup.io/reference/messages-1
// Chosen over going direct to Meta because BSP approval is faster (per the
// startup plan's Phase 2 tech choices).

const GUPSHUP_API = "https://api.gupshup.io/wa/api/v1/msg";

export async function gupshupSendMessage(opts: {
  apiKey: string;
  sourceNumber: string; // registered WhatsApp business number, no leading +
  appName: string;
  destination: string; // recipient number, no leading +
  text: string;
}) {
  const body = new URLSearchParams({
    channel: "whatsapp",
    source: opts.sourceNumber,
    destination: opts.destination,
    "src.name": opts.appName,
    message: JSON.stringify({ type: "text", text: opts.text }),
  });

  const res = await fetch(GUPSHUP_API, {
    method: "POST",
    headers: {
      apikey: opts.apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `Gupshup send failed (${res.status})`);
  }
  return data;
}

// Sends a pre-approved HSM/template message — the only way to message a
// contact outside the 24-hour customer-service window Meta enforces. Same
// endpoint as free-text sends, different `message` shape.
export async function gupshupSendTemplateMessage(opts: {
  apiKey: string;
  sourceNumber: string;
  appName: string;
  destination: string;
  gupshupTemplateId: string;
  params: string[];
}) {
  const body = new URLSearchParams({
    channel: "whatsapp",
    source: opts.sourceNumber,
    destination: opts.destination,
    "src.name": opts.appName,
    message: JSON.stringify({
      type: "template",
      template: { id: opts.gupshupTemplateId, params: opts.params },
    }),
  });

  const res = await fetch(GUPSHUP_API, {
    method: "POST",
    headers: {
      apikey: opts.apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `Gupshup template send failed (${res.status})`);
  }
  return data;
}

// Template management (create + status) uses Gupshup's per-app Template API,
// which is keyed by the Gupshup App ID (a GUID from the app's dashboard) —
// not the app name used for sending. Endpoint shapes here follow Gupshup's
// published Template Management docs as of this build; verify against a
// live Gupshup account before relying on this in production, since Gupshup
// has changed these endpoints between API versions and we don't have a real
// account to test against yet.
const GUPSHUP_TEMPLATE_API = (appId: string) => `https://api.gupshup.io/wa/app/${appId}/template`;

export async function gupshupCreateTemplate(opts: {
  apiKey: string;
  appId: string;
  elementName: string;
  category: "MARKETING" | "UTILITY";
  languageCode: string;
  content: string; // body text with {{1}}, {{2}} placeholders
  example: string; // required by Meta — same body with placeholders filled with example values
}) {
  const body = new URLSearchParams({
    elementName: opts.elementName,
    languageCode: opts.languageCode,
    category: opts.category,
    templateType: "TEXT",
    content: opts.content,
    example: opts.example,
    vertical: opts.elementName,
  });

  const res = await fetch(GUPSHUP_TEMPLATE_API(opts.appId), {
    method: "POST",
    headers: {
      apikey: opts.apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `Gupshup template creation failed (${res.status})`);
  }
  return data as { template?: { id?: string; status?: string } };
}

export async function gupshupGetTemplateStatus(opts: { apiKey: string; appId: string; gupshupTemplateId: string }) {
  const res = await fetch(GUPSHUP_TEMPLATE_API(opts.appId), {
    method: "GET",
    headers: { apikey: opts.apiKey },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `Gupshup template status fetch failed (${res.status})`);
  }
  const templates: Array<{ id?: string; status?: string; reason?: string }> = data?.templates ?? [];
  return templates.find((t) => t.id === opts.gupshupTemplateId) ?? null;
}

export interface GupshupInboundPayload {
  app?: string;
  type?: string;
  payload?: {
    id?: string;
    source?: string; // sender's WhatsApp number
    type?: string;
    payload?: { text?: string };
    sender?: { phone?: string; name?: string };
  };
}

export function parseGupshupInbound(body: GupshupInboundPayload) {
  if (body.type !== "message") return null;
  const p = body.payload;
  const text = p?.payload?.text;
  const from = p?.source || p?.sender?.phone;
  const messageId = p?.id;
  if (!text || !from) return null;
  return { from, text, name: p?.sender?.name, messageId };
}
