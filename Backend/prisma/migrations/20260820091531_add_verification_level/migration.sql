-- Hand-written, NOT `prisma migrate diff` output — the auto-generated diff
-- for this schema change drops and recreates the "verificationStatus"
-- column (losing every existing user's PENDING/VERIFIED/REJECTED status),
-- since Prisma has no built-in "rename enum + rename its values" DDL. This
-- migration instead uses Postgres's native ALTER TYPE ... RENAME, which
-- relabels the existing type/values in place and preserves every row's
-- current data untouched.

-- Rename the enum type itself: BusinessVerificationStatus -> VerificationStatus
ALTER TYPE "BusinessVerificationStatus" RENAME TO "VerificationStatus";

-- Rename its values to the new level-agnostic vocabulary. PENDING/REJECTED
-- keep their names; only the two renamed here needed a new label.
ALTER TYPE "VerificationStatus" RENAME VALUE 'UNSUBMITTED' TO 'UNVERIFIED';
ALTER TYPE "VerificationStatus" RENAME VALUE 'VERIFIED' TO 'APPROVED';

-- The column's default needs updating to match the renamed value.
ALTER TABLE "users" ALTER COLUMN "verificationStatus" SET DEFAULT 'UNVERIFIED';

-- New level field, tracking INDIVIDUAL vs BUSINESS separately from status.
CREATE TYPE "VerificationLevel" AS ENUM ('NONE', 'INDIVIDUAL', 'BUSINESS');
ALTER TABLE "users" ADD COLUMN "verificationLevel" "VerificationLevel" NOT NULL DEFAULT 'NONE';

-- Backfill: every kind of verification that existed before this migration
-- was a BUSINESS submission (INDIVIDUAL verification is new) — any row
-- with a real verification signal on file gets tagged accordingly so
-- existing verified/pending businesses aren't left at the NONE default.
UPDATE "users" SET "verificationLevel" = 'BUSINESS' WHERE "verificationDocUrl" IS NOT NULL OR "isVerified" = true;
