-- Add password reset token fields to PlatformAdmin
ALTER TABLE "PlatformAdmin" ADD COLUMN "passwordResetToken" TEXT;
ALTER TABLE "PlatformAdmin" ADD COLUMN "passwordResetTokenExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "PlatformAdmin_passwordResetToken_key" ON "PlatformAdmin"("passwordResetToken");
