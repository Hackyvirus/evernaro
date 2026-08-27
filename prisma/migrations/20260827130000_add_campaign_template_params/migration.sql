-- Campaign-level values for a WhatsApp template's {{2}}..{{n}} body variables.
-- {{1}} is the recipient's name, prepended per-send, so it is not stored here.
ALTER TABLE "Campaign" ADD COLUMN "templateParams" TEXT[] DEFAULT ARRAY[]::TEXT[];
