-- Add optional contact linkage for customer-facing invoices.
-- Existing subscription/wallet invoices remain NULL (contactId is optional).

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "contactId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_contactId_idx" ON "Invoice"("contactId");

-- AddForeignKey (idempotent: PostgreSQL does not support ADD CONSTRAINT IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_contactId_fkey'
  ) THEN
    ALTER TABLE "Invoice"
      ADD CONSTRAINT "Invoice_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
