-- AlterEnum
ALTER TYPE "ChannelType" ADD VALUE 'INSTAGRAM';

-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "instagramPageAccessToken" TEXT,
ADD COLUMN     "instagramPageId" TEXT,
ADD COLUMN     "instagramUsername" TEXT;

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "instagramUserId" TEXT;
