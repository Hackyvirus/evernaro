import { Prisma } from "@prisma/client";
import type { WalletTransaction, WalletReferenceType, WalletTransactionType, WhatsAppMessageCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendBillingEmail } from "@/lib/email-categories";

export class InsufficientWalletBalanceError extends Error {
  constructor(orgId: string) {
    super(`WhatsApp wallet balance is insufficient for org ${orgId}`);
    this.name = "InsufficientWalletBalanceError";
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

async function reportError(err: unknown, context: Record<string, unknown>) {
  if (process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(err, { tags: { context: "whatsapp-wallet" }, extra: context });
  }
  console.error("[whatsapp-wallet]", err, context);
}

export async function getOrCreateWallet(orgId: string) {
  return prisma.whatsAppWallet.upsert({
    where: { orgId },
    create: { orgId },
    update: {},
  });
}

export async function whatsappMessageCost(
  category: WhatsAppMessageCategory,
  countryCode = "IN"
): Promise<number> {
  const rate = await prisma.whatsAppRateCard.findUnique({
    where: { category_countryCode: { category, countryCode } },
  });
  if (!rate) {
    const err = new Error(`No WhatsApp rate card for ${category}/${countryCode}`);
    await reportError(err, { category, countryCode });
    throw err;
  }
  return rate.costPaise;
}

/**
 * Debits the cost of one WhatsApp message from an org's wallet, atomically
 * and idempotently. Never lets the balance go negative (the UPDATE's WHERE
 * clause and the mutation are the same statement, so a concurrent debit that
 * would overdraw simply matches zero rows). A repeated call with the same
 * (referenceType, referenceId) — e.g. a BullMQ stalled-job replay — returns
 * the original transaction instead of charging twice.
 */
export async function chargeWhatsAppMessage(
  orgId: string,
  category: WhatsAppMessageCategory,
  referenceType: WalletReferenceType,
  referenceId: string
): Promise<WalletTransaction> {
  const wallet = await getOrCreateWallet(orgId);
  const cost = await whatsappMessageCost(category);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.walletTransaction.findUnique({
      where: { referenceType_referenceId: { referenceType, referenceId } },
    });
    if (existing) return existing;

    const updated = await tx.$queryRaw<{ balancePaise: number }[]>`
      UPDATE "WhatsAppWallet"
      SET "balancePaise" = "balancePaise" - ${cost}, "updatedAt" = now()
      WHERE id = ${wallet.id} AND "balancePaise" >= ${cost}
      RETURNING "balancePaise"
    `;

    if (updated.length === 0) {
      // Insufficient at this snapshot — but a concurrent duplicate of this
      // exact reference may have already succeeded and drained the balance
      // between our existence-check above and this UPDATE. Re-check before
      // treating this as a genuine failure.
      const maybeAlreadyCharged = await tx.walletTransaction.findUnique({
        where: { referenceType_referenceId: { referenceType, referenceId } },
      });
      if (maybeAlreadyCharged) return maybeAlreadyCharged;
      throw new InsufficientWalletBalanceError(orgId);
    }

    const newBalance = updated[0].balancePaise;
    try {
      return await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "MESSAGE_DEBIT",
          amountPaise: -cost,
          balanceAfterPaise: newBalance,
          referenceType,
          referenceId,
        },
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        // Lost a race to a concurrent attempt for the same reference — undo
        // this transaction's own decrement and return the winner's row.
        await tx.$executeRaw`
          UPDATE "WhatsAppWallet" SET "balancePaise" = "balancePaise" + ${cost}, "updatedAt" = now() WHERE id = ${wallet.id}
        `;
        const winner = await tx.walletTransaction.findUnique({
          where: { referenceType_referenceId: { referenceType, referenceId } },
        });
        if (winner) return winner;
      }
      throw err;
    }
  });

  await maybeAlertLowBalance(wallet.id, orgId).catch((err) =>
    reportError(err, { orgId, phase: "low-balance-alert" })
  );

  return result;
}

/** Compensating credit for a debit whose actual Gupshup send failed. Idempotent per original transaction. */
export async function refundWhatsAppMessage(
  walletId: string,
  relatedTransactionId: string,
  note: string
): Promise<WalletTransaction | null> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.walletTransaction.findUnique({ where: { relatedTransactionId } });
    if (existing) return existing;

    const original = await tx.walletTransaction.findUnique({ where: { id: relatedTransactionId } });
    if (!original) {
      await reportError(new Error("Refund target transaction not found"), { relatedTransactionId });
      return null;
    }
    const refundAmount = Math.abs(original.amountPaise);

    const updated = await tx.$queryRaw<{ balancePaise: number }[]>`
      UPDATE "WhatsAppWallet" SET "balancePaise" = "balancePaise" + ${refundAmount}, "updatedAt" = now()
      WHERE id = ${walletId}
      RETURNING "balancePaise"
    `;
    const newBalance = updated[0]?.balancePaise ?? 0;

    try {
      return await tx.walletTransaction.create({
        data: {
          walletId,
          type: "REFUND",
          amountPaise: refundAmount,
          balanceAfterPaise: newBalance,
          relatedTransactionId,
          note,
        },
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        await tx.$executeRaw`
          UPDATE "WhatsAppWallet" SET "balancePaise" = "balancePaise" - ${refundAmount}, "updatedAt" = now() WHERE id = ${walletId}
        `;
        return tx.walletTransaction.findUnique({ where: { relatedTransactionId } });
      }
      throw err;
    }
  });
}

/** Top-ups (idempotent per invoiceId) and manual admin credits. */
export async function creditWallet(
  orgId: string,
  amountPaise: number,
  type: Extract<WalletTransactionType, "TOPUP" | "MANUAL_CREDIT">,
  opts: { invoiceId?: string; note?: string } = {},
  tx?: Prisma.TransactionClient
): Promise<WalletTransaction> {
  const doCredit = async (client: Prisma.TransactionClient) => {
    const wallet = await client.whatsAppWallet.upsert({
      where: { orgId },
      create: { orgId },
      update: {},
    });

    if (opts.invoiceId) {
      const existing = await client.walletTransaction.findUnique({ where: { invoiceId: opts.invoiceId } });
      if (existing) return existing;
    }

    const updated = await client.$queryRaw<{ balancePaise: number }[]>`
      UPDATE "WhatsAppWallet" SET "balancePaise" = "balancePaise" + ${amountPaise}, "updatedAt" = now()
      WHERE id = ${wallet.id}
      RETURNING "balancePaise"
    `;
    const newBalance = updated[0].balancePaise;

    try {
      return await client.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type,
          amountPaise,
          balanceAfterPaise: newBalance,
          invoiceId: opts.invoiceId,
          note: opts.note,
        },
      });
    } catch (err) {
      if (isUniqueConstraintError(err) && opts.invoiceId) {
        await client.$executeRaw`
          UPDATE "WhatsAppWallet" SET "balancePaise" = "balancePaise" - ${amountPaise}, "updatedAt" = now() WHERE id = ${wallet.id}
        `;
        const winner = await client.walletTransaction.findUnique({ where: { invoiceId: opts.invoiceId } });
        if (winner) return winner;
      }
      throw err;
    }
  };

  if (tx) {
    return doCredit(tx);
  }

  const wallet = await getOrCreateWallet(orgId);
  const result = await prisma.$transaction(doCredit);

  const fresh = await prisma.whatsAppWallet.findUniqueOrThrow({ where: { id: wallet.id } });
  if (fresh.lowBalanceAlertSentAt && fresh.balancePaise > fresh.lowBalanceThresholdPaise) {
    await prisma.whatsAppWallet.update({ where: { id: wallet.id }, data: { lowBalanceAlertSentAt: null } });
  }

  return result;
}

/** One-off admin correction — same non-negative guard as a message debit, no idempotency key (not retried by a job queue). */
export async function manualDebitWallet(
  orgId: string,
  amountPaise: number,
  note: string
): Promise<WalletTransaction> {
  const wallet = await getOrCreateWallet(orgId);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.$queryRaw<{ balancePaise: number }[]>`
      UPDATE "WhatsAppWallet"
      SET "balancePaise" = "balancePaise" - ${amountPaise}, "updatedAt" = now()
      WHERE id = ${wallet.id} AND "balancePaise" >= ${amountPaise}
      RETURNING "balancePaise"
    `;
    if (updated.length === 0) throw new InsufficientWalletBalanceError(orgId);
    return tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "MANUAL_DEBIT",
        amountPaise: -amountPaise,
        balanceAfterPaise: updated[0].balancePaise,
        note,
      },
    });
  });
}

async function maybeAlertLowBalance(walletId: string, orgId: string) {
  const wallet = await prisma.whatsAppWallet.findUnique({ where: { id: walletId } });
  if (!wallet) return;
  if (wallet.balancePaise > wallet.lowBalanceThresholdPaise) return;
  if (wallet.lowBalanceAlertSentAt) return; // already alerted for this crossing

  const [owner, org] = await Promise.all([
    prisma.user.findFirst({ where: { orgId, role: "OWNER" } }),
    prisma.organization.findUnique({ where: { id: orgId } }),
  ]);
  if (!owner || !org) return;

  try {
    await sendBillingEmail({
      to: owner.email,
      subject: `${org.name}: WhatsApp balance is low`,
      text: `Your Evernaro WhatsApp wallet balance is ₹${(wallet.balancePaise / 100).toFixed(2)}, at or below your alert threshold of ₹${(wallet.lowBalanceThresholdPaise / 100).toFixed(2)}. Top up from your Billing page to avoid interruptions to WhatsApp sending.`,
    });
    await prisma.whatsAppWallet.update({ where: { id: walletId }, data: { lowBalanceAlertSentAt: new Date() } });
  } catch (err) {
    await reportError(err, { orgId, walletId, phase: "low-balance-email" });
  }
}
