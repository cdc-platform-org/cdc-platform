-- CreateEnum
CREATE TYPE "PrimaryIntent" AS ENUM ('TALENT', 'EMPLOYER');
CREATE TYPE "BusinessVerificationStatus" AS ENUM ('UNSUBMITTED', 'PENDING', 'VERIFIED', 'REJECTED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "primaryIntent" "PrimaryIntent";
ALTER TABLE "users" ADD COLUMN "verificationStatus" "BusinessVerificationStatus" DEFAULT 'UNSUBMITTED';
ALTER TABLE "users" ADD COLUMN "trialStartDate" TIMESTAMP(3);

-- Backfill existing rows so verificationStatus stays consistent with the
-- pre-existing isVerified/verificationDocUrl derived-state logic instead of
-- every pre-migration Business account showing as UNSUBMITTED regardless of
-- its real state.
UPDATE "users" SET "verificationStatus" = 'VERIFIED' WHERE "isVerified" = true;
UPDATE "users" SET "verificationStatus" = 'PENDING' WHERE "isVerified" = false AND "verificationDocUrl" IS NOT NULL;
