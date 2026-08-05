import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
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

function parseCsv(text: string): ImportRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    if (!row.email && !row.phone && !row.telegramchatid && !row.instagramuserid) continue;
    rows.push({
      name: row.name || undefined,
      email: row.email || undefined,
      phone: row.phone || undefined,
      telegramChatId: row.telegramchatid || undefined,
      instagramUserId: row.instagramuserid || undefined,
      company: row.company || undefined,
      tags: row.tags || undefined,
      notes: row.notes || undefined,
    });
  }
  return rows;
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
    const rows = parseCsv(text);
    if (rows.length === 0) {
      return NextResponse.json({ error: "CSV is empty or has no valid rows" }, { status: 400 });
    }

    const created: string[] = [];
    const errors: { row: number; error: string }[] = [];

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
