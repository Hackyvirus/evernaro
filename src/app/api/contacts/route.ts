import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgId, UnauthorizedError } from "@/lib/session";
import { normalizePhone } from "@/lib/phone";

export async function GET() {
  try {
    const orgId = await requireOrgId();
    const contacts = await prisma.contact.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ contacts });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load contacts" }, { status: 500 });
  }
}

const bodySchema = z
  .object({
    name: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
    telegramChatId: z.string().optional(),
    instagramUserId: z.string().optional(),
  })
  .refine((d) => d.email || d.phone || d.telegramChatId || d.instagramUserId, {
    message: "At least one of email, phone, Telegram chat ID, or Instagram user ID is required",
  });

export async function POST(req: Request) {
  try {
    const orgId = await requireOrgId();
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const { name, email, phone, telegramChatId, instagramUserId } = parsed.data;

    const contact = await prisma.contact.create({
      data: {
        orgId,
        name: name || undefined,
        email: email ? email.toLowerCase() : undefined,
        phone: phone ? normalizePhone(phone) : undefined,
        telegramChatId: telegramChatId || undefined,
        instagramUserId: instagramUserId || undefined,
      },
    });

    return NextResponse.json({ ok: true, contact });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to create contact" }, { status: 500 });
  }
}
