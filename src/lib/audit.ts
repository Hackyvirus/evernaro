import { headers } from "next/headers";
import { AuditLogAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";

interface AuditLogInput {
  orgId?: string;
  userId?: string;
  platformAdminId?: string;
  action: AuditLogAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  result?: "SUCCESS" | "FAILURE";
  ip?: string;
  userAgent?: string;
}

export async function logAudit(input: AuditLogInput) {
  try {
    const headersList = await headers();
    const ip = input.ip ?? headersList.get("x-forwarded-for") ?? headersList.get("x-real-ip") ?? "unknown";
    const userAgent = input.userAgent ?? headersList.get("user-agent") ?? undefined;

    await prisma.auditLog.create({
      data: {
        orgId: input.orgId,
        userId: input.userId,
        platformAdminId: input.platformAdminId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: (input.metadata ?? {}) as never,
        result: input.result ?? "SUCCESS",
        ip: ip.split(",")[0]?.trim(),
        userAgent,
      },
    });
  } catch (err) {
    // Audit logging must never break the user-facing action. Log to console/Sentry
    // and continue.
    console.error("Failed to write audit log", err);
  }
}
