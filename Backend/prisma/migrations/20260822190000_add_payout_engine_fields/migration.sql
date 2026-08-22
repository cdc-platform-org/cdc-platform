-- CreateEnum
CREATE TYPE "PayoutRiskTier" AS ENUM ('LOW', 'MANUAL_REVIEW');

-- AlterEnum
-- Each ALTER TYPE ... ADD VALUE must not be used in the same transaction it
-- was added in (a hard Postgres restriction pre-12) — this migration never
-- references PROCESSING/FAILED anywhere else in its own body, so that's
-- satisfied regardless of how Prisma Migrate wraps this file.
ALTER TYPE "PayoutRequestStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "PayoutRequestStatus" ADD VALUE 'FAILED';

-- AlterTable
-- idempotencyKey starts nullable, not NOT NULL — this table already has
-- live rows from the existing manual payout-request feature (see
-- routes/wallet.ts), and Prisma's own auto-generated diff for this change
-- would otherwise add a NOT NULL column with no default, which fails
-- outright the moment this runs against a non-empty table. Backfilled
-- below, then locked to NOT NULL once every row has a value.
ALTER TABLE "payout_requests" ADD COLUMN     "autoApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "processingStartedAt" TIMESTAMP(3),
ADD COLUMN     "providerRef" TEXT,
ADD COLUMN     "riskTier" "PayoutRiskTier" NOT NULL DEFAULT 'MANUAL_REVIEW';

-- Backfill every pre-existing row with the same payout_request_<id> scheme
-- bogPayoutService.ts generates for new rows going forward, so the
-- idempotencyKey column is total (every row has one) the instant this
-- migration finishes, not just for rows created after today.
UPDATE "payout_requests" SET "idempotencyKey" = 'payout_request_' || "id" WHERE "idempotencyKey" IS NULL;

ALTER TABLE "payout_requests" ALTER COLUMN "idempotencyKey" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "payout_requests_idempotencyKey_key" ON "payout_requests"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "payout_requests_providerRef_key" ON "payout_requests"("providerRef");

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "payoutIbanUpdatedAt" TIMESTAMP(3);
