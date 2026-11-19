/**
 * BOG checkout for a pack of AI coloring-page credits.
 * Pack prices: services/coloringPages/coloringPacks.ts. Credits are added by
 * the BOG callback (bogCallback.ts -> completeColoringCreditPurchase).
 * Promo codes / gift cards: AI_TOOL target 'coloring-pages:<packId>' (see
 * couponService.ts); a fully covered pack is credited without a BOG order.
 */
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { authenticate, requireApproved } from '../../middleware/auth';
import { paymentModelForPurpose } from '../../services/payments/paymentModel';
import { PromoCode } from '@prisma/client';
import { findColoringPack } from '../../services/coloringPages/coloringPacks';
import { completeColoringCreditPurchase } from '../../services/coloringPages/coloringCreditService';
import { applyPromoToCheckout, giftCardAmountOf, PromoCodeError, COLORING_PROMO_TARGET_ID } from '../../services/payments/couponService';
import { checkoutRateLimit, CALLBACK_URL, checkoutLang, resultRedirects, createBogOrderOrRespond } from './shared';

const router = Router();

router.post('/checkout/coloring-credits/:packId', checkoutRateLimit, authenticate, requireApproved, async (req: Request, res: Response) => {
  // The price always comes from the server-side pack table, never the client.
  const pack = findColoringPack(req.params.packId);
  if (!pack) return res.status(404).json({ message: 'Unknown pack.' });
  const userId = req.user!.id;

  const rawPromoCode = typeof req.body?.promoCode === 'string' ? req.body.promoCode.trim().toUpperCase() : '';
  const requestedPromoId = rawPromoCode
    ? (await prisma.promoCode.findUnique({ where: { code: rawPromoCode }, select: { id: true } }))?.id ?? 'unknown-promo'
    : null;

  // Double-click protection: reuse a fresh PENDING order for the same pack
  // opened with the same promo code (or none).
  const fresh = await prisma.bogPayment.findFirst({
    where: { userId, purpose: 'COLORING_CREDITS', status: 'PENDING', promoCodeId: requestedPromoId, createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) }, redirectUrl: { not: null } },
    orderBy: { createdAt: 'desc' },
  });
  if (fresh) {
    const purchase = await prisma.coloringCreditPurchase.findUnique({ where: { id: fresh.referenceId }, select: { packId: true } });
    if (purchase?.packId === pack.id) return res.status(200).json({ paymentId: fresh.id, redirectUrl: fresh.redirectUrl });
  }

  let amount = pack.priceTetri;
  let appliedPromo: PromoCode | null = null;
  if (rawPromoCode) {
    try {
      const applied = await applyPromoToCheckout(rawPromoCode, 'AI_TOOL', `${COLORING_PROMO_TARGET_ID}:${pack.id}`, amount);
      amount = applied.chargeAmount;
      appliedPromo = applied.appliedPromo;
    } catch (err) {
      if (err instanceof PromoCodeError) return res.status(400).json({ message: err.message });
      throw err;
    }
  }
  const isFree = amount <= 0;

  const { payment } = await prisma.$transaction(async (tx) => {
    const purchase = await tx.coloringCreditPurchase.create({
      data: { userId, packId: pack.id, credits: pack.credits, amountTetri: pack.priceTetri },
    });
    const payment = await tx.bogPayment.create({
      data: {
        bogOrderId: isFree ? `promo-${crypto.randomUUID()}` : `pending-${crypto.randomUUID()}`,
        userId,
        purpose: 'COLORING_CREDITS',
        paymentModel: paymentModelForPurpose('COLORING_CREDITS'),
        referenceId: purchase.id,
        amount: isFree ? 0 : amount,
        currency: 'GEL',
        status: isFree ? 'COMPLETED' : 'PENDING',
        completedAt: isFree ? new Date() : null,
        promoCodeId: appliedPromo?.id ?? null,
        giftCardAmount: giftCardAmountOf(appliedPromo),
      },
    });
    return { payment };
  });

  if (isFree) {
    await completeColoringCreditPurchase(payment.referenceId);
    return res.status(201).json({ paymentId: payment.id, redirectUrl: null, purchased: true });
  }

  const { successRedirectUrl, failRedirectUrl } = resultRedirects(payment.id);
  const order = await createBogOrderOrRespond(res, {
    externalOrderId: payment.id,
    amount,
    currency: 'GEL',
    basketItemName: `AI Coloring Pages — ${pack.credits} credits`,
    callbackUrl: CALLBACK_URL,
    successRedirectUrl,
    failRedirectUrl,
    lang: checkoutLang(req),
  });
  if (!order) return;
  const updated = await prisma.bogPayment.update({
    where: { id: payment.id },
    data: { bogOrderId: order.bogOrderId, redirectUrl: order.redirectUrl },
  });
  res.status(201).json({ paymentId: updated.id, redirectUrl: order.redirectUrl });
});

export default router;
