import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { generateSecureToken, hoursFromNow } from "@/lib/token";
import { sendVerificationEmail } from "@/lib/auth-email";
import { getIndustryTemplate } from "@/lib/industry-templates";
import { createFreeSubscription } from "@/lib/billing/subscription-service";

const signupSchema = z.object({
  orgName: z.string().min(2),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  industryCode: z.string().min(1),
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
  const ip = clientIp(req);
  const ipAllowed = await checkRateLimit(`signup:${ip}`, 5, 60 * 60);
  if (!ipAllowed) {
    return NextResponse.json({ error: "Too many signup attempts — try again later." }, { status: 429 });
  }
  const globalAllowed = await checkRateLimit("signup:global", 60, 60 * 60);
  if (!globalAllowed) {
    return NextResponse.json({ error: "Signups are temporarily paused due to high volume." }, { status: 429 });
  }

  const body = await req.json();
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { orgName, name, email, password, industryCode } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const template = getIndustryTemplate(industryCode as never);
  if (!template) {
    return NextResponse.json({ error: "Invalid industry selected" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const verificationToken = generateSecureToken();

  let org: { id: string } | null = null;
  try {
    org = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: normalizedEmail } });
      if (existing) {
        throw new Error("EMAIL_EXISTS");
      }

      const baseSlug = slugify(orgName);
      let slug = `${baseSlug}-${nanoid(6)}`;
      // Defensive fallback in the extremely unlikely event of a collision.
      while (await tx.organization.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${nanoid(6)}`;
      }

      const dbTemplate = await tx.industryTemplate.findUniqueOrThrow({
        where: { code: industryCode as never },
      });

      const createdOrg = await tx.organization.create({
        data: {
          name: orgName,
          slug,
          industryTemplateId: dbTemplate.id,
          users: {
            create: {
              email: normalizedEmail,
              passwordHash,
              name,
              role: "OWNER",
              emailVerificationToken: verificationToken,
              emailVerificationTokenExpiresAt: hoursFromNow(24),
            },
          },
          businessProfile: {
            create: {
              businessName: orgName,
              industry: template.name,
              description: "",
            },
          },
          industryConfig: {
            create: {
              templateId: dbTemplate.id,
              config: {},
            },
          },
        },
      });

      const defaultServices = await Promise.all(
        template.config.defaultServices.map((s) =>
          tx.service.create({
            data: {
              orgId: createdOrg.id,
              name: s.name,
              durationMin: s.durationMin ?? null,
              priceInr: s.priceInr ?? null,
              metadata: (s.metadata ?? {}) as never,
            },
          })
        )
      );

      const existingQueue = await tx.queue.findFirst({
        where: { orgId: createdOrg.id, name: "General Queue" },
      });
      if (!existingQueue) {
        await tx.queue.create({
          data: {
            orgId: createdOrg.id,
            name: "General Queue",
            serviceId: defaultServices[0]?.id ?? null,
          },
        });
      }

      await tx.whatsAppWallet.create({
        data: {
          orgId: createdOrg.id,
          balancePaise: 0,
          lowBalanceThresholdPaise: 10000,
        },
      });

      return createdOrg;
    });
  } catch (err) {
    if (err instanceof Error && err.message === "EMAIL_EXISTS") {
      // Return a generic success response to prevent email enumeration.
      return NextResponse.json({ ok: true });
    }
    throw err;
  }

  if (org) {
    try {
      await createFreeSubscription(org.id);
    } catch (err) {
      console.error("Failed to create free subscription for new org:", err);
    }
  }

  try {
    await sendVerificationEmail(normalizedEmail, verificationToken);
  } catch {
    // Don't fail signup if email is misconfigured in this environment; the
    // user can request a fresh verification email from the login page.
    console.error("Failed to send verification email to", normalizedEmail);
  }

  return NextResponse.json({ ok: true });
}
