-- Promo codes for the Children's Book: adds the CHILDRENS_BOOK value to the
-- existing CouponApplicableType enum. Purely additive — no existing row is
-- touched, no table structure changes. See services/couponService.ts.

-- AlterEnum
ALTER TYPE "CouponApplicableType" ADD VALUE 'CHILDRENS_BOOK';
