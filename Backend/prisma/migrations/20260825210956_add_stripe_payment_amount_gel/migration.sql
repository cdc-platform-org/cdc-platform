-- AlterTable
-- Deliberately NOT a plain `ADD COLUMN "amountGel" INTEGER NOT NULL` (what
-- `prisma migrate dev` generates by default, and refuses to run against a
-- non-empty table with no default) — add it nullable first, backfill every
-- existing row, then tighten to NOT NULL. Same three-step shape as the
-- Course.status and BogPayment.paymentModel backfill migrations before this
-- one.
--
-- Backfill is an APPROXIMATION for pre-existing rows: it reverses `amount`
-- (USD/EUR minor units) back through today's default
-- STRIPE_GEL_TO_USD_RATE/STRIPE_GEL_TO_EUR_RATE (utils/env.ts) — the rate
-- actually in effect at each row's original checkout was never recorded, so
-- this cannot be exact for a row created before an admin last changed those
-- env vars. Every row created from here on sets amountGel directly from the
-- real pre-conversion GEL price at checkout time (see routes/
-- stripePayments.ts), so this approximation only ever affects historical
-- rows, never a live payout. This migration does NOT retroactively correct
-- any earningsBalance/WalletEntry a seller was already credited under the
-- old (buggy) amount-in-USD-cents-as-GEL-tetri behavior — that is a
-- separate, deliberate decision left to a business call, not attempted here.
ALTER TABLE "stripe_payments" ADD COLUMN     "amountGel" INTEGER;

UPDATE "stripe_payments" SET "amountGel" = ROUND("amount" / (CASE WHEN "currency" = 'EUR' THEN 0.33 ELSE 0.36 END))::INTEGER;

ALTER TABLE "stripe_payments" ALTER COLUMN "amountGel" SET NOT NULL;
