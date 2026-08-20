// ============================================================
// Shared sale-pricing floor — the one number both productPricing.ts
// (DigitalProduct.discountedPrice) and schemas/courseSchemas.ts
// (Course.discountPercent) validate against, so "the cheapest we'll ever
// let something sell for" can't drift between the two independently-shaped
// discount mechanisms. Below this, BOG/Stripe's per-transaction processing
// fee can exceed the sale itself.
// ============================================================

// Minor units (tetri) — 2.00 GEL.
export const MIN_SALE_PRICE_MINOR = 200;
