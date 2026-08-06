import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { seatLimit, activeSeatsUsed } from "@/lib/usage-limits";
import { sendTeamInviteEmail } from "@/lib/auth-email";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const inviteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["OWNER", "ADMIN", "AGENT", "VIEWER"]),
});

function generateTempPassword() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const bytes = randomBytes(12);
  let pass = "";
  for (let i = 0; i < 12; i++) {
    pass += chars.charAt(bytes[i] % chars.length);
  }
  return pass;
}

export async function GET() {
  try {
    const { orgId } = await requireOrgMember(UserRole.ADMIN);
    const users = await prisma.user.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
    return NextResponse.json({ users });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { orgId, userId: adminId } = await requireOrgMember(UserRole.ADMIN);
    const parsed = inviteSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { name, email, role } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }

    const usedSeats = await activeSeatsUsed(orgId);
    if (usedSeats >= seatLimit()) {
      return NextResponse.json(
        { error: `You've reached the ${seatLimit()} active-user limit. Contact support to add more seats.` },
        { status: 429 }
      );
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const [user, org] = await Promise.all([
      prisma.user.create({
        data: {
          orgId,
          name,
          email: email.toLowerCase(),
          passwordHash,
          role,
          isActive: true,
        },
        select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      }),
      prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
    ]);

    await logAudit({
      orgId,
      userId: adminId,
      action: "USER_INVITED",
      targetType: "user",
      targetId: user.id,
      metadata: { role },
    });

    try {
      await sendTeamInviteEmail(user.email, user.name, org?.name ?? "your organization", tempPassword);
    } catch {
      // Don't fail the invite if email is misconfigured; the admin can still
      // share the temporary password manually.
      console.error("Failed to send team invite email to", user.email);
    }

    return NextResponse.json({ ok: true, user, tempPassword });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to invite user" }, { status: 500 });
  }
}
