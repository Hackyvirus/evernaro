/*
  Warnings:

  - You are about to drop the column `orgId` on the `BillingRun` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "BillingRun" DROP CONSTRAINT "BillingRun_orgId_fkey";

-- DropIndex
DROP INDEX "BillingRun_orgId_status_idx";

-- AlterTable
ALTER TABLE "BillingRun" DROP COLUMN "orgId";
