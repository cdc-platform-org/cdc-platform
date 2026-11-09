-- Self-service BOG checkout for Educator VIP and Business AI agents.
-- Additive only: two enum values and two nullable columns.
ALTER TYPE "BogPaymentPurpose" ADD VALUE IF NOT EXISTS 'EDUCATOR_VIP';
ALTER TYPE "BogPaymentPurpose" ADD VALUE IF NOT EXISTS 'BUSINESS_AI_AGENT';

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "educatorVipPaidUntil" TIMESTAMP(3);
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "paidUntil" TIMESTAMP(3);
