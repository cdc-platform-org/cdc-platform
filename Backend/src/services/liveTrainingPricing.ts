import { MIN_SALE_PRICE_MINOR } from './pricingRules';

// LiveTraining's sibling of coursePricing.ts — same "compute at read time,
// never store the sale price" posture, so an expired discountEndDate
// reverts automatically with no cron. The one structural difference: a
// LiveTraining has no separate `originalPrice` column (Course.originalPrice
// plays that role there) — `price` already IS the base/full price here, and
// it's nullable (a free lead-gen session), which Course's price never is.
// A null price is never treated as "on sale" regardless of the other
// fields, since there is nothing to discount.

export interface LiveTrainingPricingInput {
  price: number | null;
  discountPercent: number | null;
  discountEndDate: Date | null;
  isOnSale: boolean;
}

export function isLiveTrainingSaleActive(training: LiveTrainingPricingInput): boolean {
  if (training.price === null) return false;
  if (!training.isOnSale || !training.discountPercent) return false;
  if (training.discountEndDate && training.discountEndDate.getTime() <= Date.now()) return false;
  return true;
}

export function getCurrentLiveTrainingPrice(training: LiveTrainingPricingInput): number | null {
  if (training.price === null) return null;
  if (!isLiveTrainingSaleActive(training)) return training.price;
  const discounted = training.price * (1 - training.discountPercent! / 100);
  return Math.round(discounted);
}

// Shape merged into every live-training API response — see
// routes/liveTrainings.ts and routes/adminLiveTrainings.ts. Same field
// names as coursePricing.ts's withCurrentPrice (currentPrice/saleActive/
// discountedPrice/saleEndsAt) so the Frontend's sale-badge display code can
// read one consistent shape off either resource.
export function withCurrentLiveTrainingPrice<T extends LiveTrainingPricingInput>(
  training: T
): T & { currentPrice: number | null; saleActive: boolean; discountedPrice: number | null; saleEndsAt: Date | null } {
  const saleActive = isLiveTrainingSaleActive(training);
  return {
    ...training,
    currentPrice: getCurrentLiveTrainingPrice(training),
    saleActive,
    discountedPrice: saleActive ? getCurrentLiveTrainingPrice(training) : null,
    saleEndsAt: training.discountEndDate,
  };
}

// Same MIN_SALE_PRICE_MINOR floor and 90% cap as
// coursePricing.ts's validateCourseDiscount — kept as a sibling function
// (not a shared one parameterized by field name) for the same reason the
// rest of this codebase duplicates the Gemini-fallback shape across
// businessAiChatService.ts/courseTutorService.ts rather than abstracting it:
// the two models' pricing rules are allowed to diverge independently later
// without one shared function having to serve both shapes.
export function validateLiveTrainingDiscount(
  price: number | null,
  discountPercent: number | null | undefined,
  isOnSale: boolean
): string | null {
  if (!isOnSale) return null;
  // AUDIT NOTE (fixed): this used to be `if (!isOnSale || !discountPercent)
  // return null` — treating "isOnSale=true but no discountPercent" as
  // nothing to validate, silently accepted. That left the row on-sale with
  // no discount, which isLiveTrainingSaleActive's own !discountPercent
  // check then just as silently hides (no badge, no crash) — a confusing
  // no-op rather than the clear rejection Course's identical scenario gets
  // (courseSchemas.ts's .refine()). Now rejected explicitly instead.
  if (!discountPercent) return 'discountPercent is required when isOnSale is true.';
  if (price === null) return 'A free training (no price set) cannot have a discount.';
  const salePrice = Math.round(price * (1 - discountPercent / 100));
  if (salePrice < MIN_SALE_PRICE_MINOR) {
    return `Sale price would be ${(salePrice / 100).toFixed(2)} GEL, below the minimum allowed (${(MIN_SALE_PRICE_MINOR / 100).toFixed(2)} GEL). Lower the discount percentage.`;
  }
  return null;
}
