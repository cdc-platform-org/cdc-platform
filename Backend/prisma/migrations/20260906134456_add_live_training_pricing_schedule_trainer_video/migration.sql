-- CreateEnum
CREATE TYPE "LiveTrainingPriceType" AS ENUM ('MONTHLY', 'TOTAL');

-- AlterTable
ALTER TABLE "live_trainings" ADD COLUMN     "durationMonths" INTEGER,
ADD COLUMN     "priceType" "LiveTrainingPriceType" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "scheduleDays" TEXT,
ADD COLUMN     "trainerVideoUrl" TEXT;
