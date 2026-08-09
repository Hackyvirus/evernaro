import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdminId, UnauthorizedError } from "@/lib/session";
import { createFreeSubscription } from "@/lib/billing/subscription-service";
import { getIndustryTemplateByCode } from "@/lib/industry-templates";

export async function GET(req: Request) {
  try {
    await requirePlatformAdminId();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "50")));
    const skip = (page - 1) * limit;

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          users: { where: { role: "OWNER" }, take: 1, select: { name: true, email: true } },
          channels: { select: { type: true, isActive: true } },
          _count: { select: { contacts: true, conversations: true } },
          conversations: {
            orderBy: { lastMessageAt: "desc" },
            take: 1,
            select: { lastMessageAt: true },
          },
        },
      }),
      prisma.organization.count(),
    ]);

    const result = organizations.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      createdAt: org.createdAt,
      monthlyFeeInr: org.monthlyFeeInr,
      owner: org.users[0] ?? null,
      channels: org.channels,
      contactCount: org._count.contacts,
      conversationCount: org._count.conversations,
      lastActivityAt: org.conversations[0]?.lastMessageAt ?? null,
    }));

    return NextResponse.json(
      { organizations: result, total, page, limit },
      {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=60",
        },
      }
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load organizations" }, { status: 500 });
  }
}

const bodySchema = z.object({
  orgName: z.string().min(2),
  ownerName: z.string().min(1),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
  monthlyFeeInr: z.number().int().nonnegative().optional(),
  industryCode: z.string().optional(),
});

function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "org"
  );
}

export async function POST(req: Request) {
  try {
    await requirePlatformAdminId();

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { orgName, ownerName, ownerEmail, ownerPassword, monthlyFeeInr, industryCode } = parsed.data;

    const existingUser = await prisma.user.findUnique({ where: { email: ownerEmail.toLowerCase() } });
    if (existingUser) {
      return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
    }

    const baseSlug = slugify(orgName);
    let slug = baseSlug;
    let suffix = 1;
    while (await prisma.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${++suffix}`;
    }

    const passwordHash = await bcrypt.hash(ownerPassword, 12);
    const template = industryCode ? getIndustryTemplateByCode(industryCode) : null;
    const dbTemplate = template
      ? await prisma.industryTemplate.findUnique({ where: { code: template.code } })
      : null;

    const org = await prisma.$transaction(async (tx) => {
      const createdOrg = await tx.organization.create({
        data: {
          name: orgName,
          slug,
          monthlyFeeInr: monthlyFeeInr ?? null,
          industryTemplateId: dbTemplate?.id ?? null,
          users: {
            create: { email: ownerEmail.toLowerCase(), passwordHash, name: ownerName, role: "OWNER" },
          },
          businessProfile: { create: { businessName: orgName, description: "" } },
        },
      });

      const defaultServices: Array<{ id: string }> = [];
      if (template?.config.defaultServices) {
        for (const svc of template.config.defaultServices) {
          const created = await tx.service.create({
            data: {
              orgId: createdOrg.id,
              name: svc.name,
              durationMin: svc.durationMin ?? 30,
              isActive: true,
            },
          });
          defaultServices.push({ id: created.id });
        }
      }

      await tx.queue.create({
        data: {
          orgId: createdOrg.id,
          name: "General Queue",
          serviceId: defaultServices[0]?.id ?? null,
        },
      });

      await tx.whatsAppWallet.create({
        data: {
          orgId: createdOrg.id,
          balancePaise: 0,
          lowBalanceThresholdPaise: 10000,
        },
      });

      return createdOrg;
    });

    try {
      await createFreeSubscription(org.id);
    } catch (err) {
      console.error("Failed to create free subscription for platform org:", err);
    }

    return NextResponse.json({ ok: true, id: org.id });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
  }
}
