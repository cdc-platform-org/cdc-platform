/**
 * BOG checkout for buying a gift card (POST /checkout/gift-card).
 */
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { authenticate, requireApproved } from '../../middleware/auth';
import { paymentModelForPurpose } from '../../services/payments/paymentModel';
import { cancelGiftCardPurchase } from '../../services/payments/giftCardService';
import { checkoutGiftCardSchema } from '../../schemas/giftCardSchemas';
import { checkoutRateLimit, CALLBACK_URL, checkoutLang, resultRedirects, createBogOrderOrRespond } from './shared';

const router = Router();

// ============================================================
// CHECKOUT — GIFT CARD
// The buyer pays the card's face value. No promo code (a gift card can't be
// bought with another promo/gift card). The GiftCard row is created
// PENDING_PAYMENT; the BOG callback mints the code (giftCardService).
// ============================================================
router.post(
  '/checkout/gift-card',
  checkoutRateLimit,
  authenticate,
  requireApproved,
  async (req: Request, res: Response) => {
    const parsed = checkoutGiftCardSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? 'Invalid gift card details.', errors: parsed.error.errors });
    const input = parsed.data;
    const amount = Math.round(input.amountGel * 100);
    const deliverAt = input.deliverAt ? new Date(input.deliverAt) : new Date();

    const { giftCard, bogPayment } = await prisma.$transaction(async (tx) => {
      const giftCard = await tx.giftCard.create({
        data: {
          purchaserId: req.user!.id,
          amount,
          senderName: input.senderName,
          recipientName: input.recipientName,
          recipientEmail: input.recipientEmail ?? null,
          message: input.message ?? null,
          design: input.design,
          deliverAt,
          suggestedItem: input.suggestedItem ?? null,
          suggestedUrl: input.suggestedUrl ?? null,
        },
      });
      const bogPayment = await tx.bogPayment.create({
        data: {
          bogOrderId: `pending-${crypto.randomUUID()}`,
          userId: req.user!.id,
          purpose: 'GIFT_CARD',
          paymentModel: paymentModelForPurpose('GIFT_CARD'),
          referenceId: giftCard.id,
          amount,
          currency: 'GEL',
          status: 'PENDING',
        },
      });
      return { giftCard, bogPayment };
    });

    const { successRedirectUrl, failRedirectUrl } = resultRedirects(bogPayment.id);
    const order = await createBogOrderOrRespond(res, {
      externalOrderId: bogPayment.id,
      amount,
      currency: 'GEL',
      basketItemName: `CDC Gift Card ${input.amountGel} GEL`,
      callbackUrl: CALLBACK_URL,
      successRedirectUrl,
      failRedirectUrl,
      lang: checkoutLang(req),
    });
    if (!order) {
      await prisma.bogPayment.update({ where: { id: bogPayment.id }, data: { status: 'FAILED' } });
      await cancelGiftCardPurchase(giftCard.id);
      return;
    }
    const updated = await prisma.bogPayment.update({
      where: { id: bogPayment.id },
      data: { bogOrderId: order.bogOrderId, redirectUrl: order.redirectUrl },
    });
    res.status(201).json({ paymentId: updated.id, giftCardId: giftCard.id, redirectUrl: order.redirectUrl });
  }
);

export default router;
