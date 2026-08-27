-- CreateEnum
CREATE TYPE "PaymentModel" AS ENUM ('DIRECT', 'ESCROW');

-- AlterEnum
-- New value only — never referenced by any DML below, so it's safe to add
-- without an admin having to write a PlatformFeeSchedule row afterward:
-- platformFeeScheduleService.ts's FALLBACK_PERCENTAGE already has a COURSE
-- entry (20%), the same "missing row -> app-level fallback" resilience the
-- other 5 service types already rely on. (Postgres won't let a value added
-- by ALTER TYPE ... ADD VALUE be used by an INSERT/UPDATE in the very same
-- migration transaction anyway — deliberately not attempted here.)
ALTER TYPE "PlatformFeeServiceType" ADD VALUE 'COURSE';

-- AlterEnum
ALTER TYPE "WalletEntryType" ADD VALUE 'COURSE_SALE_CREDIT';

-- AlterTable
ALTER TABLE "course_enrollments" ADD COLUMN     "commissionAmount" INTEGER,
ADD COLUMN     "commissionRate" DOUBLE PRECISION,
ADD COLUMN     "netAmount" INTEGER;

-- AlterTable
-- Deliberately NOT a plain `ADD COLUMN "paymentModel" "PaymentModel" NOT NULL`
-- (what `prisma migrate dev` generates by default, and refuses to run against
-- a non-empty table with no default) — add it nullable first, backfill every
-- existing row FROM its own "purpose" column, then tighten to NOT NULL only
-- once every row has a value. Same three-step shape as the Course.status
-- backfill-from-"published" migration (20260825192626).
ALTER TABLE "bog_payments" ADD COLUMN     "paymentModel" "PaymentModel";

UPDATE "bog_payments" SET "paymentModel" = CASE WHEN "purpose" IN ('COURSE', 'PRODUCT') THEN 'DIRECT' ELSE 'ESCROW' END::"PaymentModel";

ALTER TABLE "bog_payments" ALTER COLUMN "paymentModel" SET NOT NULL;

-- AlterTable
ALTER TABLE "stripe_payments" ADD COLUMN     "paymentModel" "PaymentModel";

UPDATE "stripe_payments" SET "paymentModel" = CASE WHEN "purpose" IN ('COURSE', 'PRODUCT') THEN 'DIRECT' ELSE 'ESCROW' END::"PaymentModel";

ALTER TABLE "stripe_payments" ALTER COLUMN "paymentModel" SET NOT NULL;
