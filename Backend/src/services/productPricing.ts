import { MIN_SALE_PRICE_MINOR } from './pricingRules';

// ============================================================
// Single source of truth for "what does this product actually cost right
// now" — mirrors coursePricing.ts's shape exactly (computed at read time,
// not a stored column, so an expired saleEndsAt reverts to `price`
// automatically with no cron needed), but keyed off an absolute
// discountedPrice rather than a percent, since a seller here sets a real
// floor price and the platform's 20% commission (productSaleService.ts)
// applies to whatever amount actually gets charged — a 5 GEL sale price
// nets the seller 4 GEL, same math as a full-price sale, no special case.
// ============================================================

// Deliberately independent of Course's 90%-cap policy (schemas/
// courseSchemas.ts) — a different, newer rule for a different pricing
// mechanism, not something the two should be forced to share.
export const MAX_DISCOUNT_PERCENT = 80;

export interface ProductPricingInput {
  price: number;
  discountedPrice: number | null;
  saleEndsAt: Date | null;
}

export function isProductSaleActive(product: ProductPricingInput): boolean {
  if (!product.discountedPrice) return false;
  if (product.saleEndsAt && product.saleEndsAt.getTime() <= Date.now()) return false;
  return true;
}

export function getCurrentProductPrice(product: ProductPricingInput): number {
  return isProductSaleActive(product) ? product.discountedPrice! : product.price;
}

// Shape merged into every product API response — see routes/products.ts/
// adminProducts.ts.
export function withCurrentProductPrice<T extends ProductPricingInput>(
  product: T
): T & { currentPrice: number; saleActive: boolean } {
  return {
    ...product,
    currentPrice: getCurrentProductPrice(product),
    saleActive: isProductSaleActive(product),
  };
}

// Both amounts are minor units (tetri). Returns a human-readable rejection
// reason, or null when the discount is valid — called from products.ts/
// adminProducts.ts's create/update handlers after converting the form's
// major-unit GEL inputs, so every error message here is already in the
// unit the route will report back to the client.
export function validateProductDiscount(price: number, discountedPrice: number): string | null {
  if (price <= 0) return 'A discount cannot be set on a free product.';
  if (discountedPrice <= 0) return 'Discounted price must be greater than 0.';
  if (discountedPrice >= price) return 'Discounted price must be lower than the original price.';
  if (discountedPrice < MIN_SALE_PRICE_MINOR) {
    return `Discounted price must be at least ${(MIN_SALE_PRICE_MINOR / 100).toFixed(2)} GEL.`;
  }
  // Math.ceil, not round: the floor is "at most X% off," so a fractional
  // tetri should round the allowed floor UP (stricter), never let a price
  // that's technically a hair over 80% off slip through from a rounding gift.
  const maxDiscountFloor = Math.ceil(price * (1 - MAX_DISCOUNT_PERCENT / 100));
  if (discountedPrice < maxDiscountFloor) {
    return `Discount cannot exceed ${MAX_DISCOUNT_PERCENT}% off the original price (minimum ${(maxDiscountFloor / 100).toFixed(2)} GEL).`;
  }
  return null;
}
