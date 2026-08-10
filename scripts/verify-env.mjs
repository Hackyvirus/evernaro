import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const OPTIONAL = new Set([
  "SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN",
  "SENTRY_ORG",
  "SENTRY_PROJECT",
  "SENTRY_AUTH_TOKEN",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "RAZORPAY_KEY_ID",
  "NEXT_PUBLIC_RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "INBOUND_EMAIL_WEBHOOK_SECRET",
  "DAILY_CAMPAIGN_RECIPIENT_LIMIT",
  "CAMPAIGN_RATE_PER_SECOND",
  "CAMPAIGN_WORKER_CONCURRENCY",
  "REMINDER_WORKER_CONCURRENCY",
  "SEAT_LIMIT",
  "RUN_MIGRATIONS",
  "WORKER_HEALTH_FILE",
]);

const REQUIRED = [
  "DATABASE_URL",
  "DIRECT_URL",
  "AUTH_SECRET",
  "ENCRYPTION_KEY",
  "NEXT_PUBLIC_BASE_URL",
  "REDIS_URL",
];

function checkBase64Key(name, value) {
  try {
    const buf = Buffer.from(value, "base64");
    if (buf.length !== 32) {
      return `${name} must decode to exactly 32 bytes (got ${buf.length}).`;
    }
  } catch {
    return `${name} is not valid base64.`;
  }
  return null;
}

function validate() {
  const envPath = resolve(process.cwd(), ".env");
  let env = {};
  try {
    const raw = readFileSync(envPath, "utf-8");
    env = Object.fromEntries(
      raw
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const idx = line.indexOf("=");
          if (idx === -1) return [line, ""];
          return [line.slice(0, idx).trim(), line.slice(idx + 1).trim().replace(/^"|"$/g, "")];
        })
    );
  } catch {
    // In production/Docker environments variables are injected directly; a local
    // .env file is optional. Continue validating against process.env only.
  }

  const errors = [];
  const warnings = [];

  for (const key of REQUIRED) {
    const value = process.env[key] ?? env[key];
    if (!value) {
      errors.push(`Missing required variable: ${key}`);
      continue;
    }
    if (key === "AUTH_SECRET" || key === "ENCRYPTION_KEY") {
      const err = checkBase64Key(key, value);
      if (err) errors.push(err);
    }
    if (key === "NEXT_PUBLIC_BASE_URL" && value.startsWith("http://localhost")) {
      warnings.push(`NEXT_PUBLIC_BASE_URL is still localhost (${value}) — update before production.`);
    }
  }

  for (const key of OPTIONAL) {
    const value = process.env[key] ?? env[key];
    if (!value) warnings.push(`${key} is not set — some features will be disabled.`);
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log("Environment looks ready for production.");
    process.exit(0);
  }

  if (warnings.length) {
    console.warn("Warnings:\n" + warnings.map((w) => `  ⚠ ${w}`).join("\n"));
  }
  if (errors.length) {
    console.error("Errors:\n" + errors.map((e) => `  ✗ ${e}`).join("\n"));
    process.exit(1);
  }
  process.exit(0);
}

validate();
