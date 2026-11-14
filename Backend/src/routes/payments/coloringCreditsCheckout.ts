/**
 * BOG checkout for a pack of AI coloring-page credits.
 * Pack prices: services/coloringPages/coloringPacks.ts. Credits are added by
 * the BOG callback (bogCallback.ts -> completeColoringCreditPurchase).
 */
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { authenticate, requireApproved } from '../../middleware/auth';
import { paymentModelForPurpose } from '../../services/payments/paymentModel';
import { findColoringPack } from '../../services/coloringPages/coloringPacks';
import { checkoutRateLimit, CALLBACK_URL, checkoutLang, resultRedirects, createBogOrderOrRespond } from './shared';

const router = Router();

router.post('/checkout/coloring-credits/:packId', checkoutRateLimit, authenticate, requireApproved, async (req: Request, res: Response) => {
  // The price always comes from the server-side pack table, never the client.
  const pack = findColoringPack(req.params.packId);
  if (!pack) return res.status(404).json({ message: 'Unknown pack.' });
  const userId = req.user!.id;

  // Double-click protection: reuse a fresh PENDING order for the same pack.
  const fresh = await prisma.bogPayment.findFirst({
    where: { userId, purpose: 'COLORING_CREDITS', status: 'PENDING', amount: pack.priceTetri, createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) }, redirectUrl: { not: null } },
    orderBy: { createdAt: 'desc' },
  });
  if (fresh) {
    const purchase = await prisma.coloringCreditPurchase.findUnique({ where: { id: fresh.referenceId }, select: { packId: true } });
    if (purchase?.packId === pack.id) return res.status(200).json({ paymentId: fresh.id, redirectUrl: fresh.redirectUrl });
  }

  const { payment } = await prisma.$transaction(async (tx) => {
    const purchase = await tx.coloringCreditPurchase.create({
      data: { userId, packId: pack.id, credits: pack.credits, amountTetri: pack.priceTetri },
    });
    const payment = await tx.bogPayment.create({
      data: {
        bogOrderId: `pending-${crypto.randomUUID()}`,
        userId,
        purpose: 'COLORING_CREDITS',
        paymentModel: paymentModelForPurpose('COLORING_CREDITS'),
        referenceId: purchase.id,
        amount: pack.priceTetri,
        currency: 'GEL',
        status: 'PENDING',
      },
    });
    return { payment };
  });

  const { successRedirectUrl, failRedirectUrl } = resultRedirects(payment.id);
  const order = await createBogOrderOrRespond(res, {
    externalOrderId: payment.id,
    amount: pack.priceTetri,
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
