-- Add SENDING status to campaign recipients for idempotent send locking.
ALTER TYPE "RecipientStatus" ADD VALUE IF NOT EXISTS 'SENDING';
