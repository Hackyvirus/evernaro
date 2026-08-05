-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('SUBSCRIPTION', 'WALLET_TOPUP');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('TOPUP', 'MESSAGE_DEBIT', 'REFUND', 'MANUAL_CREDIT', 'MANUAL_DEBIT');

-- CreateEnum
CREATE TYPE "WalletReferenceType" AS ENUM ('INBOX_MESSAGE', 'CAMPAIGN_RECIPIENT', 'REMINDER');

-- CreateEnum
CREATE TYPE "WhatsAppMessageCategory" AS ENUM ('MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "type" "InvoiceType" NOT NULL DEFAULT 'SUBSCRIPTION';

-- CreateTable
CREATE TABLE "WhatsAppWallet" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "balancePaise" INTEGER NOT NULL DEFAULT 0,
    "lowBalanceThresholdPaise" INTEGER NOT NULL DEFAULT 10000,
    "lowBalanceAlertSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "balanceAfterPaise" INTEGER NOT NULL,
    "referenceType" "WalletReferenceType",
    "referenceId" TEXT,
    "invoiceId" TEXT,
    "relatedTransactionId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppRateCard" (
    "id" TEXT NOT NULL,
    "category" "WhatsAppMessageCategory" NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'IN',
    "costPaise" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppRateCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppWallet_orgId_key" ON "WhatsAppWallet"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_invoiceId_key" ON "WalletTransaction"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_relatedTransactionId_key" ON "WalletTransaction"("relatedTransactionId");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_createdAt_idx" ON "WalletTransaction"("walletId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_referenceType_referenceId_key" ON "WalletTransaction"("referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppRateCard_category_countryCode_key" ON "WhatsAppRateCard"("category", "countryCode");

-- AddForeignKey
ALTER TABLE "WhatsAppWallet" ADD CONSTRAINT "WhatsAppWallet_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "WhatsAppWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_relatedTransactionId_fkey" FOREIGN KEY ("relatedTransactionId") REFERENCES "WalletTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backstop against a negative balance. Redundant with the guarded
-- `UPDATE ... WHERE "balancePaise" >= cost` used by chargeWhatsAppMessage
-- (src/lib/whatsapp-wallet.ts), which is what actually prevents overspend —
-- this CHECK exists as cheap insurance against any future code path that
-- bypasses that guarded query and decrements the column directly.
ALTER TABLE "WhatsAppWallet" ADD CONSTRAINT "WhatsAppWallet_balancePaise_nonnegative" CHECK ("balancePaise" >= 0);
