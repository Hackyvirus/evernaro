import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { parse } from "papaparse";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { normalizePhone } from "@/lib/phone";
import { logAudit } from "@/lib/audit";

interface ImportRow {
  name?: string;
  email?: string;
  phone?: string;
  telegramChatId?: string;
  instagramUserId?: string;
  company?: string;
  tags?: string;
  notes?: string;
}

function parseCsv(text: string): { rows: ImportRow[]; errors: { row: number; error: string }[] } {
  const parsed = parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  const parseErrors: { row: number; error: string }[] = parsed.errors.map((e) => ({
    row: e.row ? e.row + 2 : 0,
    error: e.message,
  }));

  const rows: ImportRow[] = [];
  parsed.data.forEach((row, idx) => {
    const email = row.email?.trim();
    const phone = row.phone?.trim();
    const telegramChatId = row.telegramchatid?.trim();
    const instagramUserId = row.instagramuserid?.trim();

    if (!email && !phone && !telegramChatId && !instagramUserId) {
      parseErrors.push({ row: idx + 2, error: "At least one channel identifier is required" });
      return;
    }

    rows.push({
      name: row.name?.trim() || undefined,
      email: email || undefined,
      phone: phone || undefined,
      telegramChatId: telegramChatId || undefined,
      instagramUserId: instagramUserId || undefined,
      company: row.company?.trim() || undefined,
      tags: row.tags?.trim() || undefined,
      notes: row.notes?.trim() || undefined,
    });
  });

  return { rows, errors: parseErrors };
}

export async function POST(req: Request) {
  try {
    const { orgId, userId } = await requireOrgMember(UserRole.ADMIN);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const { rows, errors: parseErrors } = parseCsv(text);
    if (rows.length === 0 && parseErrors.length === 0) {
      return NextResponse.json({ error: "CSV is empty or has no valid rows" }, { status: 400 });
    }

    const created: string[] = [];
    const errors: { row: number; error: string }[] = [...parseErrors];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const contact = await prisma.contact.create({
          data: {
            orgId,
            name: row.name,
            email: row.email?.toLowerCase(),
            phone: row.phone ? normalizePhone(row.phone) : undefined,
            telegramChatId: row.telegramChatId,
            instagramUserId: row.instagramUserId,
            company: row.company,
            tags: row.tags ? row.tags.split(";").map((t) => t.trim()).filter(Boolean) : [],
            notes: row.notes,
          },
        });
        created.push(contact.id);
      } catch (err) {
        errors.push({ row: i + 2, error: err instanceof Error ? err.message : "Failed" });
      }
    }

    await logAudit({
      orgId,
      userId,
      action: "OTHER",
      targetType: "contact",
      metadata: { action: "bulk_import", created: created.length, errors: errors.length },
    });

    return NextResponse.json({ ok: true, created: created.length, errors });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to import contacts" }, { status: 500 });
  }
}
