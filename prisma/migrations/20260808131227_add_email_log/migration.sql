-- CreateEnum
CREATE TYPE "EmailLogCategory" AS ENUM ('AUTH', 'BILLING', 'SUPPORT', 'CONTACT', 'NOTIFICATIONS', 'SECURITY', 'MARKETING');

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "category" "EmailLogCategory" NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "replyTo" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailLog_category_createdAt_idx" ON "EmailLog"("category", "createdAt");

-- CreateIndex
CREATE INDEX "EmailLog_status_createdAt_idx" ON "EmailLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");
