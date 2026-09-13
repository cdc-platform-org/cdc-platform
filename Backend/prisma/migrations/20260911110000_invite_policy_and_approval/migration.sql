CREATE TYPE "LiveTrainingInvitePolicy" AS ENUM ('FREE_ENROLLMENT', 'REGISTRATION_ONLY', 'PAYMENT_REQUIRED');
CREATE TYPE "LiveTrainingInviteRequestStatus" AS ENUM ('ACTIVE', 'PENDING_APPROVAL', 'REGISTRATION_ONLY', 'REJECTED');
ALTER TABLE "live_training_invites" ADD COLUMN "policy" "LiveTrainingInvitePolicy" NOT NULL DEFAULT 'PAYMENT_REQUIRED', ADD COLUMN "requiresApproval" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "startsAt" TIMESTAMP(3);
-- Preserve existing free-training links; paid links continue to require checkout.
UPDATE "live_training_invites" AS invite SET "policy" = 'FREE_ENROLLMENT' FROM "live_trainings" AS training WHERE invite."liveTrainingId" = training.id AND COALESCE(training.price, 0) <= 0;
ALTER TABLE "live_training_invite_redemptions" ADD COLUMN "status" "LiveTrainingInviteRequestStatus" NOT NULL DEFAULT 'ACTIVE';
