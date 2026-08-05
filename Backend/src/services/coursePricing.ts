// Single source of truth for "what does this course actually cost right now".
// Deliberately NOT a stored column — computed at read time so an expired
// discountEndDate reverts to originalPrice automatically, with no cron job
// needed to "turn off" a sale. All prices are Int minor units (tetri),
// matching this codebase's money convention everywhere else.

export interface CoursePricingInput {
  originalPrice: number;
  discountPercent: number | null;
  discountEndDate: Date | null;
  isOnSale: boolean;
}

export function isSaleActive(course: CoursePricingInput): boolean {
  if (!course.isOnSale || !course.discountPercent) return false;
  if (course.discountEndDate && course.discountEndDate.getTime() <= Date.now()) return false;
  return true;
}

export function getCurrentPrice(course: CoursePricingInput): number {
  if (!isSaleActive(course)) return course.originalPrice;
  const discounted = course.originalPrice * (1 - course.discountPercent! / 100);
  return Math.round(discounted);
}

// Shape merged into every course API response — see routes/courses.ts.
export function withCurrentPrice<T extends CoursePricingInput>(course: T): T & { currentPrice: number; saleActive: boolean } {
  return {
    ...course,
    currentPrice: getCurrentPrice(course),
    saleActive: isSaleActive(course),
  };
}

// Applies a PromoCode's discount to a given amount — a plain arithmetic
// helper, not the checkout pricing rule itself (see
// computeCoursePriceWithPromo below for that).
export function computeDiscount(promo: { discountPercent: number | null; discountAmount: number | null }, amount: number): number {
  if (promo.discountPercent) return Math.round(amount * (1 - promo.discountPercent / 100));
  if (promo.discountAmount) return Math.max(0, amount - promo.discountAmount);
  return amount;
}

// The actual checkout pricing rule when a promo code is applied — shared by
// routes/promos.ts's validate endpoint and routes/payments.ts's checkout, so
// the two can never disagree about the math:
//   1. The promo discount is always computed against originalPrice, never
//      against an already-discounted sale price (no stacking).
//   2. The customer is charged whichever is LOWER: the promo price, or
//      whatever the course's own active sale price already is — a promo
//      code can never make a course cost MORE than its current sale price.
export function computeCoursePriceWithPromo(
  course: CoursePricingInput,
  promo: { discountPercent: number | null; discountAmount: number | null }
): number {
  const promoPrice = computeDiscount(promo, course.originalPrice);
  const currentSalePrice = getCurrentPrice(course);
  return Math.min(promoPrice, currentSalePrice);
}
