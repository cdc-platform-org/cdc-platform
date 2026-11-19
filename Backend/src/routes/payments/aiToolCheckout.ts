/**
 * BOG checkout for the 30-day AI tool purchase (29 GEL, one tool, no
 * auto-renew). Promo codes and GIFT-XXXX-XXXX gift cards are re-validated
 * here (couponService, AI_TOOL target = the tool key); a 100% code grants
 * the period immediately without a BOG order. Fulfilment:
 * services/payments/aiToolSubscriptionService.ts.
 */
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { PromoCode } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { authenticate, requireApproved } from '../../middleware/auth';
import { AI_TOOL_MONTHLY_PRICE_MINOR, isAiSubscriptionTool } from '../../config/aiToolSubscriptions';
import { paymentModelForPurpose } from '../../services/payments/paymentModel';
import { applyPromoToCheckout, giftCardAmountOf, PromoCodeError } from '../../services/payments/couponService';
import { grantAiToolSubscriptionPeriod } from '../../services/payments/aiToolSubscriptionService';
import { resolveDigitalToolAccess } from '../../services/marketplace/digitalToolAccessService';
import { checkoutRateLimit, CALLBACK_URL, checkoutLang, resultRedirects, findReusablePendingOrder, createBogOrderOrRespond } from './shared';

const router = Router();
router.post('/checkout/ai-tool/:key', checkoutRateLimit, authenticate, requireApproved, async (req: Request, res: Response) => {
  const key = req.params.key;
  if (!isAiSubscriptionTool(key)) return res.status(404).json({ message: 'Unknown AI tool.' });
  const catalog = await prisma.siteContent.findUnique({ where: { page: 'tool-catalog' }, select: { content: true } });
  const slug = key === 'chatbot-builder' || key === 'ai-agents' ? 'enterprise-ai' : key;
  const tools = (catalog?.content as { tools?: { slug?: string; status?: string }[] } | null)?.tools;
  const entry = Array.isArray(tools) ? tools.find(tool => tool.slug === slug) : undefined;
  const admin = (await prisma.user.findUnique({ where: { id: req.user!.id }, select: { adminRole: true } }))?.adminRole;
  if (entry?.status === 'DISABLED' || entry?.status === 'COMING_SOON' || (entry?.status === 'ADMIN_ONLY' && !admin)) return res.status(403).json({ message: 'This tool is not available for purchase.' });

  // Admins, course students whose course includes this tool and admin
  // grants already have it — never charge them. A paid buyer CAN buy again
  // (an early renewal appends 30 days), and a trial user can buy any time.
  const access = await resolveDigitalToolAccess(req.user!.id, req.user!.email, key);
  if (access.allowed && ['ADMIN', 'COURSE', 'GRANT'].includes(access.source)) return res.json({ included: true, enrolled: true, redirectUrl: null });

  const requestedPromoCode = typeof req.body?.promoCode === 'string' ? req.body.promoCode.trim().toUpperCase() : '';
  const requestedPromoId = requestedPromoCode
    ? (await prisma.promoCode.findUnique({ where: { code: requestedPromoCode }, select: { id: true } }))?.id ?? 'unknown-promo'
    : null;
  // Never accepts a client-supplied price or period.
  const reusable = await findReusablePendingOrder(req.user!.id, 'AI_TOOL_SUBSCRIPTION', key, undefined, requestedPromoId);
  if (reusable) return res.json({ paymentId: reusable.id, redirectUrl: reusable.redirectUrl });

  let amount = AI_TOOL_MONTHLY_PRICE_MINOR;
  let appliedPromo: PromoCode | null = null;
  if (requestedPromoCode) {
    try {
      const applied = await applyPromoToCheckout(requestedPromoCode, 'AI_TOOL', key, amount);
      amount = applied.chargeAmount;
      appliedPromo = applied.appliedPromo;
    } catch (err) {
      if (err instanceof PromoCodeError) return res.status(400).json({ message: err.message });
      throw err;
    }
  }

  if (amount <= 0) {
    // Fully covered by a promo or gift card: record the payment as done and
    // grant the period in the same transaction.
    const payment = await prisma.$transaction(async tx => {
      const created = await tx.bogPayment.create({ data: {
        bogOrderId: `promo-${crypto.randomUUID()}`, userId: req.user!.id, purpose: 'AI_TOOL_SUBSCRIPTION', paymentModel: paymentModelForPurpose('AI_TOOL_SUBSCRIPTION'),
        referenceId: key, amount: 0, currency: 'GEL', status: 'COMPLETED', completedAt: new Date(),
        promoCodeId: appliedPromo?.id ?? null, giftCardAmount: giftCardAmountOf(appliedPromo),
      } });
      await grantAiToolSubscriptionPeriod(tx, req.user!.id, key, created.id);
      return created;
    });
    return res.status(201).json({ paymentId: payment.id, redirectUrl: null, enrolled: true });
  }

  const payment = await prisma.bogPayment.create({ data: {
    bogOrderId: `pending-${crypto.randomUUID()}`, userId: req.user!.id, purpose: 'AI_TOOL_SUBSCRIPTION', paymentModel: paymentModelForPurpose('AI_TOOL_SUBSCRIPTION'),
    referenceId: key, amount, currency: 'GEL', status: 'PENDING',
    promoCodeId: appliedPromo?.id ?? null, giftCardAmount: giftCardAmountOf(appliedPromo),
  } });
  const { successRedirectUrl, failRedirectUrl } = resultRedirects(payment.id);
  const order = await createBogOrderOrRespond(res, { externalOrderId: payment.id, amount, currency: 'GEL', basketItemName: `CDC ${key} — 30 days`, callbackUrl: CALLBACK_URL, successRedirectUrl, failRedirectUrl, lang: checkoutLang(req) });
  if (!order) return;
  await prisma.bogPayment.update({ where: { id: payment.id }, data: { bogOrderId: order.bogOrderId, redirectUrl: order.redirectUrl } });
  res.status(201).json({ paymentId: payment.id, redirectUrl: order.redirectUrl });
});
export default router;
