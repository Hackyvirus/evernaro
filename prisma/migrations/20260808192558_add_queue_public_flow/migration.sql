-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "publicToken" TEXT;

-- AlterTable
ALTER TABLE "Queue" ADD COLUMN     "noShowThresholdSeconds" INTEGER NOT NULL DEFAULT 120;

-- AlterTable
ALTER TABLE "QueueEntry" ADD COLUMN     "autoNoShowJobId" TEXT,
ADD COLUMN     "publicToken" TEXT,
ADD COLUMN     "verificationCode" TEXT,
ADD COLUMN     "verificationCodeExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CustomerFlowSession" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "contactId" TEXT,
    "queueEntryId" TEXT,
    "appointmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "CustomerFlowSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerFlowSession_token_key" ON "CustomerFlowSession"("token");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerFlowSession_queueEntryId_key" ON "CustomerFlowSession"("queueEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerFlowSession_appointmentId_key" ON "CustomerFlowSession"("appointmentId");

-- CreateIndex
CREATE INDEX "CustomerFlowSession_orgId_createdAt_idx" ON "CustomerFlowSession"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_publicToken_key" ON "Appointment"("publicToken");

-- CreateIndex
CREATE UNIQUE INDEX "QueueEntry_publicToken_key" ON "QueueEntry"("publicToken");

-- CreateIndex
CREATE INDEX "QueueEntry_publicToken_idx" ON "QueueEntry"("publicToken");

-- AddForeignKey
ALTER TABLE "CustomerFlowSession" ADD CONSTRAINT "CustomerFlowSession_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerFlowSession" ADD CONSTRAINT "CustomerFlowSession_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerFlowSession" ADD CONSTRAINT "CustomerFlowSession_queueEntryId_fkey" FOREIGN KEY ("queueEntryId") REFERENCES "QueueEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerFlowSession" ADD CONSTRAINT "CustomerFlowSession_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
