-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "discountBadgeText" TEXT;

-- AlterTable
ALTER TABLE "live_trainings" ADD COLUMN     "discountBadgeText" TEXT,
ADD COLUMN     "discountEndDate" TIMESTAMP(3),
ADD COLUMN     "discountPercent" INTEGER,
ADD COLUMN     "isOnSale" BOOLEAN NOT NULL DEFAULT false;
