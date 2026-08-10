import crypto from "node:crypto";

// Voice calling via Twilio Programmable Voice.
//
// Chosen over Exotel (the plan doc's India-first default) because Twilio's
// call API is a clean, self-contained REST + webhook contract: you POST to
// create a call and point it at a URL you host, Twilio hits that URL for
// TwiML instructions. Exotel's equivalent (dynamic per-call TTS) requires
// pre-building an "App"/flow in their dashboard per account — something that
// can't be wired up without an actual Exotel account to configure by hand.
// Swapping providers later is a matter of implementing this same interface.

const TWILIO_API = "https://api.twilio.com/2010-04-01";

/**
 * Verify Twilio's X-Twilio-Signature header.
 * See https://www.twilio.com/docs/usage/security#validating-requests
 */
export function verifyTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string | null
): boolean {
  if (!signature) return false;
  const sortedKeys = Object.keys(params).sort();
  const payload =
    url +
    sortedKeys.map((key) => key + params[key]).join("");
  const expected = crypto
    .createHmac("sha1", authToken)
    .update(payload, "utf8")
    .digest("base64");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function twilioPlaceCall(opts: {
  accountSid: string;
  authToken: string;
  from: string;
  to: string;
  twimlUrl: string;
  statusCallbackUrl: string;
}) {
  const body = new URLSearchParams({
    To: opts.to,
    From: opts.from,
    Url: opts.twimlUrl,
    StatusCallback: opts.statusCallbackUrl,
    StatusCallbackEvent: "initiated ringing answered completed",
  });

  const res = await fetch(`${TWILIO_API}/Accounts/${opts.accountSid}/Calls.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${opts.accountSid}:${opts.authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `Twilio call failed (${res.status})`);
  }
  return data as { sid: string; status: string };
}

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildSayTwiml(text: string, language = "en-IN") {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="woman" language="${language}">${escapeXml(text)}</Say></Response>`;
}

// Twilio's CallStatus values (from both the Calls API response and the
// StatusCallback webhook), mapped onto our own CallStatus enum.
export function mapTwilioStatus(twilioStatus: string): "INITIATED" | "RINGING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "NO_ANSWER" | "BUSY" {
  switch (twilioStatus) {
    case "queued":
    case "initiated":
      return "INITIATED";
    case "ringing":
      return "RINGING";
    case "in-progress":
    case "answered":
      return "IN_PROGRESS";
    case "completed":
      return "COMPLETED";
    case "busy":
      return "BUSY";
    case "no-answer":
      return "NO_ANSWER";
    default:
      return "FAILED";
  }
}
