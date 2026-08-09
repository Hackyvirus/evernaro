-- AlterTable
ALTER TABLE "PlatformAdmin" ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- DropIndex
DROP INDEX "Message_providerMessageId_idx";

-- AlterTable
ALTER TABLE "Message" ALTER COLUMN "providerMessageId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Message_providerMessageId_idx" ON "Message"("providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_providerMessageId_conversationId_key" ON "Message"("providerMessageId", "conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_one_open_per_contact_channel_key" ON "Conversation"("orgId", "contactId", "channelId") WHERE status = 'OPEN';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "periodStart" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN     "periodEnd" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_subscriptionId_type_periodEnd_key" ON "Invoice"("subscriptionId", "type", "periodEnd");

-- AlterTable
ALTER TABLE "DunningRecord" ADD COLUMN     "eventId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DunningRecord_eventId_key" ON "DunningRecord"("eventId");

-- AlterTable
ALTER TABLE "CustomerSubscription" ADD COLUMN     "couponId" TEXT;
ALTER TABLE "CustomerSubscription" ADD COLUMN     "couponDiscountMonthsRemaining" INTEGER;

-- CreateIndex
CREATE INDEX "CustomerSubscription_couponId_idx" ON "CustomerSubscription"("couponId");

-- AddForeignKey
ALTER TABLE "CustomerSubscription" ADD CONSTRAINT "CustomerSubscription_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "CustomerSubscription_one_active_per_org_key" ON "CustomerSubscription"("orgId") WHERE status IN ('TRIALING', 'ACTIVE');

