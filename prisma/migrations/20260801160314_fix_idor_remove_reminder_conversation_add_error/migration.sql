/*
  Warnings:

  - You are about to drop the column `conversationId` on the `Reminder` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Reminder" DROP CONSTRAINT "Reminder_conversationId_fkey";

-- AlterTable
ALTER TABLE "Reminder" DROP COLUMN "conversationId",
ADD COLUMN     "error" TEXT;
