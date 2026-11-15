import { hasActiveCollegeAiAccess } from '../../services/learning/collegeAiAccessService';
/**
 * BOG checkout for flat-price AI subscriptions: English tutor (IMIAKO),
 * Educator VIP and Business AI agents.
 */
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { PromoCode } from '@prisma/client';
import { authenticate, requireApproved } from '../../middleware/auth';
import { paymentModelForPurpose } from '../../services/payments/paymentModel';
import { applyPromoToCheckout, PromoCodeError, giftCardAmountOf } from '../../services/payments/couponService';
import {
  completeTutorSubscriptionPurchase,
  TUTOR_SUBSCRIPTION_PRICE_GEL,
} from '../../services/educator/englishTutorSubscriptionService';
import { completeEducatorVipPurchase, EDUCATOR_VIP_PRICE_GEL } from '../../services/educator/educatorVipService';
import {
  assertAgentPurchasable,
  completeAgentPurchase,
  AgentCheckoutError,
  BUSINESS_AI_PRICE_GEL,
} from '../../services/ai/agentSubscriptionService';
import {
  checkoutRateLimit,
  CALLBACK_URL,
  checkoutLang,
  resultRedirects,
  findReusablePendingOrder,
  createBogOrderOrRespond,
} from './shared';

const router = Router();

// ============================================================
// CHECKOUT — ENGLISH TUTOR (IMIAKO) SUBSCRIPTION
// A flat 50 GEL/month access purchase — no target row to look up (unlike
// every other purpose above), referenceId is just the buyer's own User.id.
// No promo codes, no capacity check, no instructor payout — the simplest
// checkout in this file. See englishTutorSubscriptionService.ts's own
// comment for why this is a plain one-time purchase, not a real recurring
// charge.
// ============================================================
router.post(
  '/checkout/english-tutor',
  checkoutRateLimit,
  authenticate,
  requireApproved,
  async (req: Request, res: Response) => {
    if (await hasActiveCollegeAiAccess(req.user!.id)) return res.json({ enrolled: true, redirectUrl: null, included: true });
    // A pending order is only reused when it was opened with the same promo
    // code (or none), so a buyer who comes back with a code never lands on
    // an earlier full-price BOG order.
    const requestedPromoCode = typeof req.body?.promoCode === 'string' ? req.body.promoCode.trim().toUpperCase() : '';
    const requestedPromoId = requestedPromoCode
      ? (await prisma.promoCode.findUnique({ where: { code: requestedPromoCode }, select: { id: true } }))?.id ?? 'unknown-promo'
      : null;
    const reusable = await findReusablePendingOrder(req.user!.id, 'ENGLISH_TUTOR_SUBSCRIPTION', req.user!.id, undefined, requestedPromoId);
    if (reusable) return res.status(200).json({ paymentId: reusable.id, redirectUrl: reusable.redirectUrl });

    const requesterAdminRole = (await prisma.user.findUnique({ where: { id: req.user!.id }, select: { adminRole: true } }))?.adminRole;
    let chargeAmount = requesterAdminRole ? 0 : TUTOR_SUBSCRIPTION_PRICE_GEL;

    // Same re-validated-server-side promo handling as CHECKOUT — COURSE —
    // see couponService.ts's applyPromoToCheckout. AI_TOOL targetId
    // 'english-tutor' — see couponService.ts's resolveTargetPrice.
    const rawPromoCode = typeof req.body?.promoCode === 'string' ? req.body.promoCode : null;
    let appliedPromo: PromoCode | null = null;
    if (rawPromoCode && chargeAmount > 0) {
      try {
        const applied = await applyPromoToCheckout(rawPromoCode, 'AI_TOOL', 'english-tutor', chargeAmount);
        chargeAmount = applied.chargeAmount;
        appliedPromo = applied.appliedPromo;
      } catch (err) {
        if (err instanceof PromoCodeError) return res.status(400).json({ message: err.message });
        throw err;
      }
    }

    if (chargeAmount <= 0) {
      const freePayment = await prisma.bogPayment.create({
        data: {
          bogOrderId: `admin-test-${crypto.randomUUID()}`,
          userId: req.user!.id,
          purpose: 'ENGLISH_TUTOR_SUBSCRIPTION',
          paymentModel: paymentModelForPurpose('ENGLISH_TUTOR_SUBSCRIPTION'),
          referenceId: req.user!.id,
          amount: 0,
          currency: 'GEL',
          status: 'COMPLETED',
          completedAt: new Date(),
          promoCodeId: appliedPromo?.id ?? null,
          giftCardAmount: giftCardAmountOf(appliedPromo),
        },
      });
      await completeTutorSubscriptionPurchase(req.user!.id);
      return res.status(201).json({ paymentId: freePayment.id, redirectUrl: null, enrolled: true });
    }

    const bogPayment = await prisma.bogPayment.create({
      data: {
        bogOrderId: `pending-${crypto.randomUUID()}`,
        userId: req.user!.id,
        purpose: 'ENGLISH_TUTOR_SUBSCRIPTION',
        paymentModel: paymentModelForPurpose('ENGLISH_TUTOR_SUBSCRIPTION'),
        referenceId: req.user!.id,
        amount: chargeAmount,
        currency: 'GEL',
        status: 'PENDING',
        promoCodeId: appliedPromo?.id ?? null,
        giftCardAmount: giftCardAmountOf(appliedPromo),
      },
    });
    const { successRedirectUrl, failRedirectUrl } = resultRedirects(bogPayment.id);
    const order = await createBogOrderOrRespond(res, {
      externalOrderId: bogPayment.id,
      amount: chargeAmount,
      currency: 'GEL',
      basketItemName: 'IMIAKO — AI English Tutor (1 month)',
      callbackUrl: CALLBACK_URL,
      successRedirectUrl,
      failRedirectUrl,
      lang: checkoutLang(req),
    });
    if (!order) return;
    const updated = await prisma.bogPayment.update({
      where: { id: bogPayment.id },
      data: { bogOrderId: order.bogOrderId, redirectUrl: order.redirectUrl },
    });
    res.status(201).json({ paymentId: updated.id, redirectUrl: order.redirectUrl });
  }
);

// ============================================================
// CHECKOUT — EDUCATOR VIP (50 GEL / 30 days) and BUSINESS AI AGENT
// (49 GEL / 30 days per agent). Same flat, non-recurring shape as the
// English tutor checkout above, with the promo code re-validated here
// (AI_TOOL targets 'educator-hub' / 'business-ai', see couponService).
// ============================================================
async function flatAiToolCheckout(
  req: Request,
  res: Response,
  opts: {
    purpose: 'EDUCATOR_VIP' | 'BUSINESS_AI_AGENT';
    referenceId: string;
    price: number;
    promoTargetId: string;
    basketItemName: string;
    complete: () => Promise<unknown>;
  }
) {
  if (await hasActiveCollegeAiAccess(req.user!.id)) return res.json({ enrolled: true, redirectUrl: null, included: true });
  const requestedPromoCode = typeof req.body?.promoCode === 'string' ? req.body.promoCode.trim().toUpperCase() : '';
  const requestedPromoId = requestedPromoCode
    ? (await prisma.promoCode.findUnique({ where: { code: requestedPromoCode }, select: { id: true } }))?.id ?? 'unknown-promo'
    : null;
  const reusable = await findReusablePendingOrder(req.user!.id, opts.purpose, opts.referenceId, undefined, requestedPromoId);
  if (reusable) return res.status(200).json({ paymentId: reusable.id, redirectUrl: reusable.redirectUrl });

  const requesterAdminRole = (await prisma.user.findUnique({ where: { id: req.user!.id }, select: { adminRole: true } }))?.adminRole;
  let chargeAmount = requesterAdminRole ? 0 : opts.price;
  let appliedPromo: PromoCode | null = null;
  if (requestedPromoCode && chargeAmount > 0) {
    try {
      const applied = await applyPromoToCheckout(requestedPromoCode, 'AI_TOOL', opts.promoTargetId, chargeAmount);
      chargeAmount = applied.chargeAmount;
      appliedPromo = applied.appliedPromo;
    } catch (err) {
      if (err instanceof PromoCodeError) return res.status(400).json({ message: err.message });
      throw err;
    }
  }

  if (chargeAmount <= 0) {
    const freePayment = await prisma.bogPayment.create({
      data: {
        bogOrderId: `admin-test-${crypto.randomUUID()}`,
        userId: req.user!.id,
        purpose: opts.purpose,
        paymentModel: paymentModelForPurpose(opts.purpose),
        referenceId: opts.referenceId,
        amount: 0,
        currency: 'GEL',
        status: 'COMPLETED',
        completedAt: new Date(),
        promoCodeId: appliedPromo?.id ?? null,
        giftCardAmount: giftCardAmountOf(appliedPromo),
      },
    });
    await opts.complete();
    return res.status(201).json({ paymentId: freePayment.id, redirectUrl: null, enrolled: true });
  }

  const bogPayment = await prisma.bogPayment.create({
    data: {
      bogOrderId: `pending-${crypto.randomUUID()}`,
      userId: req.user!.id,
      purpose: opts.purpose,
      paymentModel: paymentModelForPurpose(opts.purpose),
      referenceId: opts.referenceId,
      amount: chargeAmount,
      currency: 'GEL',
      status: 'PENDING',
      promoCodeId: appliedPromo?.id ?? null,
      giftCardAmount: giftCardAmountOf(appliedPromo),
    },
  });
  const { successRedirectUrl, failRedirectUrl } = resultRedirects(bogPayment.id);
  const order = await createBogOrderOrRespond(res, {
    externalOrderId: bogPayment.id,
    amount: chargeAmount,
    currency: 'GEL',
    basketItemName: opts.basketItemName,
    callbackUrl: CALLBACK_URL,
    successRedirectUrl,
    failRedirectUrl,
    lang: checkoutLang(req),
  });
  if (!order) return;
  const updated = await prisma.bogPayment.update({
    where: { id: bogPayment.id },
    data: { bogOrderId: order.bogOrderId, redirectUrl: order.redirectUrl },
  });
  res.status(201).json({ paymentId: updated.id, redirectUrl: order.redirectUrl });
}

router.post('/checkout/educator-vip', checkoutRateLimit, authenticate, requireApproved, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  await flatAiToolCheckout(req, res, {
    purpose: 'EDUCATOR_VIP',
    referenceId: userId,
    price: EDUCATOR_VIP_PRICE_GEL,
    promoTargetId: 'educator-hub',
    basketItemName: 'AI Educator VIP (1 month)',
    complete: () => completeEducatorVipPurchase(userId),
  });
});

router.post('/checkout/business-ai/:agentId', checkoutRateLimit, authenticate, requireApproved, async (req: Request, res: Response) => {
  const agentId = req.params.agentId;
  try {
    await assertAgentPurchasable(agentId, req.user!.id);
  } catch (err) {
    if (err instanceof AgentCheckoutError) {
      return res.status(err.code === 'NOT_FOUND' ? 404 : 409).json({ code: err.code, message: err.message });
    }
    throw err;
  }
  await flatAiToolCheckout(req, res, {
    purpose: 'BUSINESS_AI_AGENT',
    referenceId: agentId,
    price: BUSINESS_AI_PRICE_GEL,
    promoTargetId: 'business-ai',
    basketItemName: 'CDC Business AI agent (1 month)',
    complete: () => completeAgentPurchase(agentId),
  });
});

export default router;
