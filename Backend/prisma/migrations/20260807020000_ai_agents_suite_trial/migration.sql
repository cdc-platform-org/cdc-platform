-- AlterTable
ALTER TABLE "users" ADD COLUMN "aiTrialEndsAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "aiSubscriptionActive" BOOLEAN NOT NULL DEFAULT false;
