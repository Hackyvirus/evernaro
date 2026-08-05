-- AlterTable
ALTER TABLE "BusinessProfile" ADD COLUMN     "address" TEXT,
ADD COLUMN     "aiInstructions" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "faqs" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "formality" TEXT NOT NULL DEFAULT 'semi-formal',
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "policies" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "products" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "website" TEXT,
ADD COLUMN     "workingHours" TEXT;
