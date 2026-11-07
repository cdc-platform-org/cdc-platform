import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { resendGiftCardSchema } from '../schemas/giftCardSchemas';
import {
  GIFT_CARD_DESIGNS,
  GIFT_CARD_MAX_GEL,
  GIFT_CARD_MIN_GEL,
  GIFT_CARD_PRESETS_GEL,
  GIFT_CARD_VALIDITY_DAYS,
  GiftCardError,
  getGiftCardBalance,
  publicGiftCard,
  resendGiftCardEmail,
} from '../services/giftCardService';

// Buying happens through POST /api/payments/checkout/gift-card (BOG).
const router = Router();

// Code lookups are public (the recipient may not have an account yet), so
// they're throttled hard enough to make guessing codes pointless
// (31^8 combinations per prefix).
const balanceRateLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 30, message: 'Too many attempts. Please wait a moment and try again.' });
const resendRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: 'Too many resend attempts. Please try again later.' });

router.get('/config', (_req: Request, res: Response) => {
  res.json({
    data: {
      presetsGel: GIFT_CARD_PRESETS_GEL,
      minGel: GIFT_CARD_MIN_GEL,
      maxGel: GIFT_CARD_MAX_GEL,
      designs: GIFT_CARD_DESIGNS,
      validityDays: GIFT_CARD_VALIDITY_DAYS,
    },
  });
});

router.get('/balance', balanceRateLimit, async (req: Request, res: Response) => {
  const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
  if (!code || code.length > 40) return res.status(400).json({ message: 'Enter a gift card code.' });
  const card = await getGiftCardBalance(code);
  if (!card) return res.status(404).json({ message: 'სასაჩუქრე ბარათი ვერ მოიძებნა.' });
  res.json({ data: card });
});

router.get('/my', authenticate, async (req: Request, res: Response) => {
  const cards = await prisma.giftCard.findMany({
    where: { purchaserId: req.user!.id, status: { not: 'CANCELLED' } },
    include: { promoCode: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: cards.filter((c) => c.status !== 'PENDING_PAYMENT' || Date.now() - c.createdAt.getTime() < 24 * 60 * 60 * 1000).map(publicGiftCard) });
});

router.get('/my/:id', authenticate, async (req: Request, res: Response) => {
  const card = await prisma.giftCard.findFirst({ where: { id: req.params.id, purchaserId: req.user!.id }, include: { promoCode: true } });
  if (!card) return res.status(404).json({ message: 'Gift card not found.' });
  res.json({ data: publicGiftCard(card) });
});

router.post('/my/:id/resend', authenticate, resendRateLimit, async (req: Request, res: Response) => {
  const parsed = resendGiftCardSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? 'Invalid email.' });
  try {
    const card = await resendGiftCardEmail(req.params.id, req.user!.id, parsed.data.recipientEmail ?? null);
    const full = await prisma.giftCard.findUniqueOrThrow({ where: { id: card.id }, include: { promoCode: true } });
    res.json({ data: publicGiftCard(full) });
  } catch (err) {
    if (err instanceof GiftCardError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

export default router;
