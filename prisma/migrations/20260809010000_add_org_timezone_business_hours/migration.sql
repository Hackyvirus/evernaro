-- Add timezone and structured business hours to Organization for public queue/appointment logic.

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "businessHours" JSONB NOT NULL DEFAULT '[{"day":1,"open":"10:00","close":"20:00"},{"day":2,"open":"10:00","close":"20:00"},{"day":3,"open":"10:00","close":"20:00"},{"day":4,"open":"10:00","close":"20:00"},{"day":5,"open":"10:00","close":"20:00"},{"day":6,"open":"10:00","close":"20:00"}]';
