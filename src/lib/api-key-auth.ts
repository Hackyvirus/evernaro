"server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { OrganizationStatus } from "@prisma/client";
import { checkRateLimit, clientIp } from "./rate-limit";

const API_KEY_BCRYPT_COST = 10;

export async function hashApiKey(key: string) {
  return bcrypt.hash(key, API_KEY_BCRYPT_COST);
}

export function generateApiKey() {
  const prefix = "evr_live_";
  const random = crypto.randomBytes(24).toString("base64url");
  return `${prefix}${random}`;
}

export function apiKeyPrefix(key: string) {
  return key.slice(0, 16);
}

export async function authenticateApiKey(request: Request) {
  const ip = clientIp(request);
  const allowed = await checkRateLimit(`apikey:auth:${ip}`, 20, 60, { failClosed: true });
  if (!allowed) return null;

  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;

  // Look up candidate keys by a fast prefix index, then bcrypt-compare only
  // the small subset that share the prefix. Existing keys created before the
  // prefix column was added have keyPrefix = '', so they won't be found here
  // and must be rotated.
  const prefix = apiKeyPrefix(token);
  const keys = await prisma.apiKey.findMany({
    where: { keyPrefix: prefix, isActive: true },
    include: { org: true },
    take: 100,
  });

  let matched: (typeof keys)[number] | null = null;
  for (const key of keys) {
    if (await bcrypt.compare(token, key.keyHash)) {
      matched = key;
      break;
    }
  }

  if (!matched) return null;
  if (matched.expiresAt && matched.expiresAt < new Date()) return null;

  // API keys are only valid for fully active organizations. PAST_DUE and
  // SUSPENDED orgs can still use dashboard session auth for recovery/billing,
  // but programmatic access is blocked until the account is current.
  if (matched.org.status !== OrganizationStatus.ACTIVE) {
    return null;
  }

  await prisma.apiKey.update({ where: { id: matched.id }, data: { lastUsedAt: new Date() } });
  return { orgId: matched.orgId, scopes: matched.scopes };
}
