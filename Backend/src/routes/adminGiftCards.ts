import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { publicGiftCard, deliverGiftCard, issueComplimentaryGiftCard } from '../services/giftCardService';
import { issueComplimentaryGiftCardSchema } from '../schemas/giftCardSchemas';
import { logAdminAction } from '../services/auditLogService';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

// Every gift card ever bought (except abandoned checkouts), newest first,
// with buyer, recipient, code, remaining balance and how often it was used.
router.get('/', async (_req: Request, res: Response) => {
  const cards = await prisma.giftCard.findMany({
    where: { status: { not: 'CANCELLED' } },
    include: { promoCode: true, purchaser: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });
  const visible = cards.filter((c) => c.status !== 'PENDING_PAYMENT' || Date.now() - c.createdAt.getTime() < 24 * 60 * 60 * 1000);
  const minted = visible.filter((c) => c.promoCode);
  const paid = minted.filter((c) => !c.complimentary);
  const free = minted.filter((c) => c.complimentary);
  res.json({
    data: visible.map((c) => ({ ...publicGiftCard(c), uses: c.promoCode?.currentUses ?? 0, purchaser: c.purchaser })),
    totals: {
      soldCount: paid.length,
      soldAmount: paid.reduce((sum, c) => sum + c.amount, 0),
      complimentaryCount: free.length,
      complimentaryAmount: free.reduce((sum, c) => sum + c.amount, 0),
      outstandingBalance: minted.reduce((sum, c) => sum + (c.promoCode?.isActive ? Math.max(0, c.promoCode.discountAmount ?? 0) : 0), 0),
    },
  });
});

// Issue a FREE gift card (no payment) to a person or an organization. The
// code is minted immediately; the recipient is emailed now or on deliverAt,
// and the card shows up under the admin's own /dashboard/gift-cards too
// (print / resend), since purchaserId is the issuing admin.
router.post('/', async (req: Request, res: Response) => {
  const parsed = issueComplimentaryGiftCardSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? 'Invalid gift card details.', errors: parsed.error.errors });
  const input = parsed.data;
  const card = await issueComplimentaryGiftCard({
    issuedById: req.user!.id,
    amountTetri: Math.round(input.amountGel * 100),
    senderName: input.senderName,
    recipientName: input.recipientName,
    recipientType: input.recipientType,
    recipientEmail: input.recipientEmail ?? null,
    message: input.message ?? null,
    design: input.design,
    deliverAt: input.deliverAt ? new Date(input.deliverAt) : new Date(),
  });
  await logAdminAction({
    action: 'giftCard.issueComplimentary',
    targetType: 'GiftCard',
    targetId: card.id,
    performedById: req.user!.id,
    metadata: { amountTetri: card.amount, recipientName: card.recipientName, recipientType: card.recipientType, code: card.promoCode?.code ?? null },
  });
  res.status(201).json({ data: publicGiftCard(card) });
});

// Send a scheduled card right now (e.g. the buyer asked support to).
router.post('/:id/deliver-now', async (req: Request, res: Response) => {
  const delivered = await deliverGiftCard(req.params.id);
  if (!delivered) return res.status(400).json({ message: 'This gift card is not waiting to be sent.' });
  await logAdminAction({ action: 'giftCard.deliverNow', targetType: 'GiftCard', targetId: req.params.id, performedById: req.user!.id });
  res.json({ ok: true });
});

export default router;
