import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { publicGiftCard, deliverGiftCard } from '../services/giftCardService';
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
  const paid = visible.filter((c) => c.promoCode);
  res.json({
    data: visible.map((c) => ({ ...publicGiftCard(c), uses: c.promoCode?.currentUses ?? 0, purchaser: c.purchaser })),
    totals: {
      soldCount: paid.length,
      soldAmount: paid.reduce((sum, c) => sum + c.amount, 0),
      outstandingBalance: paid.reduce((sum, c) => sum + (c.promoCode?.isActive ? Math.max(0, c.promoCode.discountAmount ?? 0) : 0), 0),
    },
  });
});

// Send a scheduled card right now (e.g. the buyer asked support to).
router.post('/:id/deliver-now', async (req: Request, res: Response) => {
  const delivered = await deliverGiftCard(req.params.id);
  if (!delivered) return res.status(400).json({ message: 'This gift card is not waiting to be sent.' });
  await logAdminAction({ action: 'giftCard.deliverNow', targetType: 'GiftCard', targetId: req.params.id, performedById: req.user!.id });
  res.json({ ok: true });
});

export default router;
