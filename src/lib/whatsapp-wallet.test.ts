import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

/**
 * A minimal in-memory double of the specific Postgres semantics
 * chargeWhatsAppMessage relies on: the guarded `UPDATE ... WHERE ...
 * RETURNING` is atomic against concurrent callers (simulated here with a
 * per-wallet promise chain, mirroring the row lock Postgres takes for the
 * real statement), and the unique constraints on (referenceType,
 * referenceId) / invoiceId / relatedTransactionId turn a duplicate ledger
 * insert into a thrown P2002 error. This tests chargeWhatsAppMessage's own
 * control flow — the DB-level guarantees themselves (the CHECK constraint,
 * the unique indexes) are enforced by the migration in
 * prisma/migrations/20260802141818_whatsapp_wallet/migration.sql, already
 * applied against the real dev database.
 */
function createFakeDb(initialBalancePaise: number) {
  const wallet = {
    id: "wallet_1",
    orgId: "org_1",
    balancePaise: initialBalancePaise,
    lowBalanceThresholdPaise: 10000,
    lowBalanceAlertSentAt: null as Date | null,
  };
  const transactions: Array<{
    id: string;
    walletId: string;
    type: string;
    amountPaise: number;
    balanceAfterPaise: number;
    referenceType: string | null;
    referenceId: string | null;
    invoiceId: string | null;
    relatedTransactionId: string | null;
    note: string | null;
  }> = [];
  let nextId = 1;
  let walletLock: Promise<unknown> = Promise.resolve();

  function findByReference(referenceType: unknown, referenceId: unknown) {
    return transactions.find((t) => t.referenceType === referenceType && t.referenceId === referenceId) ?? null;
  }

  const tx = {
    walletTransaction: {
      findUnique: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if (where.referenceType_referenceId) {
          const { referenceType, referenceId } = where.referenceType_referenceId as Record<string, unknown>;
          return findByReference(referenceType, referenceId);
        }
        if (typeof where.invoiceId === "string") {
          return transactions.find((t) => t.invoiceId === where.invoiceId) ?? null;
        }
        if (typeof where.relatedTransactionId === "string") {
          return transactions.find((t) => t.relatedTransactionId === where.relatedTransactionId) ?? null;
        }
        if (typeof where.id === "string") {
          return transactions.find((t) => t.id === where.id) ?? null;
        }
        return null;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (data.referenceType && findByReference(data.referenceType, data.referenceId)) {
          throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
            code: "P2002",
            clientVersion: "test",
          });
        }
        if (data.invoiceId && transactions.some((t) => t.invoiceId === data.invoiceId)) {
          throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
            code: "P2002",
            clientVersion: "test",
          });
        }
        if (data.relatedTransactionId && transactions.some((t) => t.relatedTransactionId === data.relatedTransactionId)) {
          throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
            code: "P2002",
            clientVersion: "test",
          });
        }
        const row = {
          id: `tx_${nextId++}`,
          walletId: data.walletId as string,
          type: data.type as string,
          amountPaise: data.amountPaise as number,
          balanceAfterPaise: data.balanceAfterPaise as number,
          referenceType: (data.referenceType as string) ?? null,
          referenceId: (data.referenceId as string) ?? null,
          invoiceId: (data.invoiceId as string) ?? null,
          relatedTransactionId: (data.relatedTransactionId as string) ?? null,
          note: (data.note as string) ?? null,
        };
        transactions.push(row);
        return row;
      }),
    },
    $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: number[]) => {
      const sql = strings.join("");
      const delta = values[0];
      if (sql.includes("balancePaise\" - ")) {
        if (wallet.balancePaise < delta) return [];
        wallet.balancePaise -= delta;
        return [{ balancePaise: wallet.balancePaise }];
      }
      wallet.balancePaise += delta;
      return [{ balancePaise: wallet.balancePaise }];
    }),
    $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: number[]) => {
      const sql = strings.join("");
      const delta = values[0];
      if (sql.includes("balancePaise\" + ")) wallet.balancePaise += delta;
      else wallet.balancePaise -= delta;
    }),
  };

  return {
    wallet,
    transactions,
    prisma: {
      whatsAppWallet: {
        upsert: vi.fn(async () => wallet),
        findUnique: vi.fn(async () => ({ ...wallet })),
        findUniqueOrThrow: vi.fn(async () => ({ ...wallet })),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(wallet, data);
          return wallet;
        }),
      },
      whatsAppRateCard: {
        findUnique: vi.fn(async ({ where }: { where: { category_countryCode: { category: string } } }) => {
          const rates: Record<string, number> = { MARKETING: 78, UTILITY: 35, AUTHENTICATION: 35, SERVICE: 0 };
          const category = where.category_countryCode.category;
          return { costPaise: rates[category] ?? 0 };
        }),
      },
      user: { findFirst: vi.fn(async () => null) },
      organization: { findUnique: vi.fn(async () => null) },
      // Serializes concurrent $transaction calls against this single wallet,
      // mirroring the row lock the real guarded UPDATE takes in Postgres.
      $transaction: vi.fn(async (callback: (fakeTx: typeof tx) => Promise<unknown>) => {
        const run = walletLock.then(() => callback(tx));
        walletLock = run.catch(() => {});
        return run;
      }),
    },
  };
}

const fakeDb = { current: createFakeDb(0) };

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return fakeDb.current.prisma;
  },
}));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));

beforeEach(() => {
  fakeDb.current = createFakeDb(1000); // ₹10.00
});

describe("chargeWhatsAppMessage", () => {
  it("debits the cost and returns a MESSAGE_DEBIT transaction when balance is sufficient", async () => {
    const { chargeWhatsAppMessage } = await import("./whatsapp-wallet");
    const tx = await chargeWhatsAppMessage("org_1", "UTILITY", "CAMPAIGN_RECIPIENT", "recipient_1");
    expect(tx.amountPaise).toBe(-35);
    expect(fakeDb.current.wallet.balancePaise).toBe(965);
  });

  it("throws InsufficientWalletBalanceError and never creates a transaction when balance is too low", async () => {
    fakeDb.current = createFakeDb(10); // ₹0.10, less than any real rate
    const { chargeWhatsAppMessage, InsufficientWalletBalanceError } = await import("./whatsapp-wallet");
    await expect(chargeWhatsAppMessage("org_1", "UTILITY", "CAMPAIGN_RECIPIENT", "recipient_1")).rejects.toThrow(
      InsufficientWalletBalanceError
    );
    expect(fakeDb.current.wallet.balancePaise).toBe(10); // untouched
    expect(fakeDb.current.transactions).toHaveLength(0);
  });

  it("is idempotent — a repeated call for the same reference returns the original charge, not a second debit", async () => {
    const { chargeWhatsAppMessage } = await import("./whatsapp-wallet");
    const first = await chargeWhatsAppMessage("org_1", "MARKETING", "REMINDER", "reminder_1");
    const balanceAfterFirst = fakeDb.current.wallet.balancePaise;

    const second = await chargeWhatsAppMessage("org_1", "MARKETING", "REMINDER", "reminder_1");

    expect(second.id).toBe(first.id);
    expect(fakeDb.current.wallet.balancePaise).toBe(balanceAfterFirst); // no second decrement
    expect(fakeDb.current.transactions).toHaveLength(1);
  });

  it("never takes the balance negative under concurrent debits for a low balance", async () => {
    fakeDb.current = createFakeDb(50); // enough for exactly one UTILITY (35) charge, not two
    const { chargeWhatsAppMessage, InsufficientWalletBalanceError } = await import("./whatsapp-wallet");

    const results = await Promise.allSettled([
      chargeWhatsAppMessage("org_1", "UTILITY", "CAMPAIGN_RECIPIENT", "recipient_a"),
      chargeWhatsAppMessage("org_1", "UTILITY", "CAMPAIGN_RECIPIENT", "recipient_b"),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientWalletBalanceError);
    expect(fakeDb.current.wallet.balancePaise).toBe(15); // 50 - 35, never negative
  });
});
