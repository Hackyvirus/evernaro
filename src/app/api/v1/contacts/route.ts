import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { findOrCreateContact, requireContactLimitIfNew, UsageLimitExceededError } from "@/lib/contact-identity";
import { requireActiveSubscription, SubscriptionSuspendedError } from "@/lib/subscription";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

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

async function checkApiRateLimit(request: Request, orgId: string, path: string) {
  const ip = clientIp(request);
  const allowed = await checkRateLimit(`api-v1:${path}:${orgId}:${ip}`, 100, 60);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  return null;
}

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireScope(auth.scopes, "contacts") && !auth.scopes.includes("read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateLimited = await checkApiRateLimit(request, auth.orgId, "contacts:read");
  if (rateLimited) return rateLimited;

  const contacts = await prisma.contact.findMany({
    where: { orgId: auth.orgId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, name: true, phone: true, email: true, company: true, tags: true, createdAt: true },
  });
  return NextResponse.json({ contacts });
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateApiKey(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!requireScope(auth.scopes, "contacts")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rateLimited = await checkApiRateLimit(request, auth.orgId, "contacts:write");
    if (rateLimited) return rateLimited;

    await requireActiveSubscription(auth.orgId);

    const parsed = contactSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    try {
      await requireContactLimitIfNew(parsed.data, auth.orgId);
    } catch (err) {
      if (err instanceof UsageLimitExceededError) {
        return NextResponse.json({ error: err.message }, { status: 402 });
      }
      throw err;
    }

    const contact = await findOrCreateContact(parsed.data, auth.orgId);
    return NextResponse.json(
      {
        contact: {
          id: contact.id,
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
          company: contact.company,
          tags: contact.tags,
          createdAt: contact.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof SubscriptionSuspendedError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof UsageLimitExceededError) {
      return NextResponse.json({ error: err.message }, { status: 402 });
    }
    throw err;
  }
}
