import { Resend } from "resend";

let client: Resend | null = null;

function getClient(apiKeyOverride?: string | null) {
  const apiKey = apiKeyOverride || process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (apiKeyOverride) return new Resend(apiKeyOverride); // per-org key, don't cache across orgs
  if (!client) client = new Resend(apiKey);
  return client;
}

export async function sendEmail(opts: {
  apiKeyOverride?: string | null;
  from: string;
  replyTo?: string | string[];
  to: string;
  subject: string;
  text: string;
}) {
  const resend = getClient(opts.apiKeyOverride);
  if (!resend) {
    throw new Error("Email sending is not configured (missing Resend API key)");
  }
  const { error } = await resend.emails.send({
    from: opts.from,
    replyTo: opts.replyTo,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
  });
  if (error) throw new Error(error.message);
}
