import { randomBytes } from "node:crypto";

const b64 = (bytes) => randomBytes(bytes).toString("base64");
const hex = (bytes) => randomBytes(bytes).toString("hex");

const secrets = {
  AUTH_SECRET: b64(32),
  ENCRYPTION_KEY: b64(32),
  INBOUND_EMAIL_WEBHOOK_SECRET: hex(24),
};

const output = [
  "Copy these into your environment (and only your environment — never commit them).",
  "",
  ...Object.entries(secrets).map(([key, value]) => `${key}="${value}"`),
  "",
  "Note: AUTH_SECRET derives your channel webhook secrets too. Rotating AUTH_SECRET",
  "after channels are connected will invalidate their webhook URLs and require",
  "reconnecting each channel.",
].join("\n");

console.log(output);
