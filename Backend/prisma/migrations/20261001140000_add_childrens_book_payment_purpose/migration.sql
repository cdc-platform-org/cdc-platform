-- Children's Book product: adds the CHILDRENS_BOOK value to the existing
-- BogPaymentPurpose enum (shared by StripePayment.purpose too). Purely
-- additive — no existing row's purpose value is touched, no table
-- structure changes. See services/paymentModel.ts / bookPurchaseFulfillment.ts.

-- AlterEnum
ALTER TYPE "BogPaymentPurpose" ADD VALUE 'CHILDRENS_BOOK';
