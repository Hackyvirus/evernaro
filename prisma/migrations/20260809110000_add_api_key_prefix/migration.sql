-- Add a keyPrefix column for fast API-key lookup without scanning all keys.
ALTER TABLE "ApiKey" ADD COLUMN "keyPrefix" TEXT NOT NULL DEFAULT '';
CREATE INDEX "ApiKey_keyPrefix_isActive_idx" ON "ApiKey"("keyPrefix", "isActive");
