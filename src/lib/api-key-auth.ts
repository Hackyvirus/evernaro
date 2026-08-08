"server-only";
import crypto from "node:crypto";
import { prisma } from "./prisma";

export function hashApiKey(key: string) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function generateApiKey() {
  const prefix = "evr_live_";
  const random = crypto.randomBytes(24).toString("base64url");
  return `${prefix}${random}`;
}

export async function authenticateApiKey(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;

  const hash = hashApiKey(token);
  const key = await prisma.apiKey.findUnique({
    where: { keyHash: hash },
    include: { org: true },
  });
  if (!key || !key.isActive || (key.expiresAt && key.expiresAt < new Date())) return null;

  await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
  return { orgId: key.orgId, scopes: key.scopes };
}
