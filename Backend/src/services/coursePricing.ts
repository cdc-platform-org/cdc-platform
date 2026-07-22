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
