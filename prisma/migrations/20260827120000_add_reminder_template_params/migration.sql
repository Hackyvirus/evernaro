-- Ordered WhatsApp template body params for a reminder's linked template.
-- Built at schedule time so the send-time worker no longer has to reconstruct
-- service/business/date/time. Existing rows and manual reminders keep an empty
-- array; the worker falls back to a single name param for those.
ALTER TABLE "Reminder" ADD COLUMN "templateParams" TEXT[] DEFAULT ARRAY[]::TEXT[];
