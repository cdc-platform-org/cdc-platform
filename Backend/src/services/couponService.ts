import { prisma } from '../lib/prisma';
import { PromoCode, CouponApplicableType } from '@prisma/client';
import { getCurrentPrice } from './coursePricing';
import { getCurrentProductPrice } from './productPricing';
import { TUTOR_SUBSCRIPTION_PRICE_GEL } from './englishTutorSubscriptionService';

// ============================================================
// Universal promo-code validation/pricing — the single place every checkout
// route (course, live training, digital product, the flat-price AI-tool
// subscriptions) and the admin Coupons panel go through, so the targeting
// rule and the discount math can never drift out of sync between them.
// ============================================================

export type CouponTargetType = Exclude<CouponApplicableType, 'ALL'>;

export class PromoCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PromoCodeError';
  }
}

// Exact copy the user-facing UI must show verbatim on a type/target
// mismatch — validated in routes/promos.ts, not re-derived per caller.
export const PROMO_TARGET_MISMATCH_MESSAGE = 'ეს პრომო კოდი არ ვრცელდება არჩეულ პროდუქტზე';

// Re-validated at checkout time (never trusting whatever discountedAmount
// the client saw from a prior POST /promos/validate call), same posture the
// pre-existing course-only flow already had. Throws PromoCodeError with a
// message safe to show the user directly.
export async function findValidPromoCode(rawCode: string, targetType: CouponTargetType, targetId: string): Promise<PromoCode> {
  const code = rawCode.trim().toUpperCase();
  const promo = await prisma.promoCode.findUnique({ where: { code } });
  if (!promo) throw new PromoCodeError('Invalid promo code.');
  if (!promo.isActive) throw new PromoCodeError('This promo code is no longer active.');
  if (promo.expiresAt && promo.expiresAt < new Date()) throw new PromoCodeError('This promo code has expired.');
  if (promo.maxUses && promo.currentUses >= promo.maxUses) throw new PromoCodeError('This promo code has reached its usage limit.');
  if (promo.applicableType !== 'ALL') {
    if (promo.applicableType !== targetType || !promo.applicableTargetIds.includes(targetId)) {
      throw new PromoCodeError(PROMO_TARGET_MISMATCH_MESSAGE);
    }
  }
  return promo;
}

// Plain arithmetic — percent OR a fixed minor-units amount off, never both
// (a promo is only ever created with one of the two set; see
// adminCoupons.ts's own schema).
export function computeDiscount(promo: { discountPercent: number | null; discountAmount: number | null }, amount: number): number {
  if (promo.discountPercent) return Math.round(amount * (1 - promo.discountPercent / 100));
  if (promo.discountAmount) return Math.max(0, amount - promo.discountAmount);
  return amount;
}

// The actual checkout pricing rule: the discount is always computed against
// the item's true original price, never an already-discounted sale price
// (no stacking), and the customer is charged whichever is LOWER — the promo
// price, or whatever the item's own active sale price already is. Same
// rule coursePricing.ts's pre-existing computeCoursePriceWithPromo already
// enforced for courses; generalized here for every product type.
export function computePromoPrice(currentPrice: number, originalPrice: number, promo: { discountPercent: number | null; discountAmount: number | null }): number {
  const promoPrice = computeDiscount(promo, originalPrice);
  return Math.min(promoPrice, currentPrice);
}

export class CouponTargetNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CouponTargetNotFoundError';
  }
}

// Resolves "what does this specific target cost right now" for every
// applicable type, so routes/promos.ts's /validate endpoint and every
// checkout route share one lookup instead of re-deriving it per caller.
// originalAmount is what a struck-through price would show (current price,
// including any active sale) — the promo discount itself is still computed
// against the item's TRUE original price inside computePromoPrice above.
export async function resolveTargetPrice(targetType: CouponTargetType, targetId: string): Promise<{ currentPrice: number; originalPrice: number }> {
  switch (targetType) {
    case 'COURSE': {
      const course = await prisma.course.findUnique({ where: { id: targetId } });
      if (!course) throw new CouponTargetNotFoundError('Course not found.');
      return { currentPrice: getCurrentPrice(course), originalPrice: course.originalPrice };
    }
    case 'LIVE_TRAINING': {
      const training = await prisma.liveTraining.findUnique({ where: { id: targetId } });
      if (!training || !training.price) throw new CouponTargetNotFoundError('Live training not found or is free.');
      return { currentPrice: training.price, originalPrice: training.price };
    }
    case 'DIGITAL_PRODUCT': {
      const product = await prisma.digitalProduct.findUnique({ where: { id: targetId } });
      if (!product) throw new CouponTargetNotFoundError('Product not found.');
      return { currentPrice: getCurrentProductPrice(product), originalPrice: product.price };
    }
    case 'AI_TOOL': {
      // No unified paid AI-tool catalog exists yet (see this session's own
      // notes — Business AI tools are free-access, Educator VIP is a
      // trial+billing subscription, not a one-off checkout) — English
      // Tutor is the one flat-price AI-tool purchase with a real checkout
      // route today. Extend this map as more are added.
      const AI_TOOL_PRICES: Record<string, number> = { 'english-tutor': TUTOR_SUBSCRIPTION_PRICE_GEL };
      const price = AI_TOOL_PRICES[targetId];
      if (price == null) throw new CouponTargetNotFoundError('Unknown AI tool.');
      return { currentPrice: price, originalPrice: price };
    }
  }
}

// Shared by every checkout route (BOG + Stripe, course/live-training/
// product/AI-tool) — validates the code (if one was sent), re-derives the
// target's true original price server-side, and returns the actual amount
// to charge. Never trusts a client-supplied discountedAmount. Returns the
// unmodified baseChargeAmount and a null promo when no code was sent, so a
// caller never needs its own separate "no promo" branch.
// AUDIT NOTE (fixed): the usage claim used to be a separate step
// (recordPromoRedemption), called by each checkout route only once its own
// order/free-grant was created — a plain read-check here (findValidPromoCode)
// followed, several lines and sometimes a network call later, by an
// unconditional `currentUses: { increment: 1 }`. That's a check-then-act
// race: two concurrent checkouts arriving near maxUses could both pass the
// read check before either write landed, letting a capped/single-use code be
// redeemed more times than maxUses allows. Fixed by claiming the slot
// atomically right here, as part of applying the promo — every caller of
// this function is already at the "about to create an order" point (the
// separate /promos/validate preview endpoint calls findValidPromoCode
// directly, never this function, so a plain preview still never spends a
// use). `currentUses: { lt: promo.maxUses }` re-checks the cap as part of
// the same atomic write; only one concurrent claim near the limit can ever
// win, and the loser gets a clear, retriable error instead of silently
// succeeding uncounted.
export async function applyPromoToCheckout(
  rawPromoCode: string | null | undefined,
  targetType: CouponTargetType,
  targetId: string,
  baseChargeAmount: number
): Promise<{ chargeAmount: number; appliedPromo: PromoCode | null }> {
  if (!rawPromoCode) return { chargeAmount: baseChargeAmount, appliedPromo: null };
  const promo = await findValidPromoCode(rawPromoCode, targetType, targetId);
  const { originalPrice } = await resolveTargetPrice(targetType, targetId);
  const chargeAmount = computePromoPrice(baseChargeAmount, originalPrice, promo);

  if (promo.maxUses != null) {
    const claim = await prisma.promoCode.updateMany({
      where: { id: promo.id, currentUses: { lt: promo.maxUses } },
      data: { currentUses: { increment: 1 } },
    });
    if (claim.count === 0) throw new PromoCodeError('This promo code has just reached its usage limit.');
  } else {
    await prisma.promoCode.update({ where: { id: promo.id }, data: { currentUses: { increment: 1 } } });
  }

  return { chargeAmount, appliedPromo: promo };
}
