import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";

const contactSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  company: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

function requireScope(scopes: string[], scope: string) {
  return scopes.includes(scope) || scopes.includes("write");
}

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireScope(auth.scopes, "contacts") && !auth.scopes.includes("read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const contacts = await prisma.contact.findMany({
    where: { orgId: auth.orgId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, name: true, phone: true, email: true, company: true, tags: true, createdAt: true },
  });
  return NextResponse.json({ contacts });
}

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireScope(auth.scopes, "contacts")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = contactSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const contact = await prisma.contact.create({
    data: { orgId: auth.orgId, ...parsed.data },
    select: { id: true, name: true, phone: true, email: true, company: true, tags: true, createdAt: true },
  });
  return NextResponse.json({ contact }, { status: 201 });
}
