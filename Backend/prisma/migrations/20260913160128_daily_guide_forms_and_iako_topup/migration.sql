-- AlterTable
ALTER TABLE "iako_profile_assignments" ADD COLUMN     "autoTopUpAmount" INTEGER,
ADD COLUMN     "autoTopUpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "initialRequestLimit" INTEGER,
ADD COLUMN     "maxAutoTopUps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxAutoTotal" INTEGER;

-- AlterTable
ALTER TABLE "iako_usage_grants" ADD COLUMN     "autoTopUpsApplied" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "live_trainings" ADD COLUMN     "mediaConsentFormUrl" TEXT;

-- AlterTable
ALTER TABLE "training_days" ADD COLUMN     "attendanceFormUrl" TEXT,
ADD COLUMN     "feedbackFormUrl" TEXT;
