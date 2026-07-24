import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { createPayoutRequestSchema } from '../schemas/payoutSchemas';
const router = Router();
router.get('/me', authenticate, requireRole('Student'), async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10)));
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { earningsBalance: true },
  });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  const [entries, totalCount] = await prisma.$transaction([
    prisma.walletEntry.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.walletEntry.count({ where: { userId: req.user!.id } }),
  ]);
  res.json({
    earningsBalance: user.earningsBalance,
    history: { items: entries, totalCount, page, pageSize },
  });
});
// ============================================================
// PAYOUT REQUESTS — student-initiated withdrawal of earningsBalance to a
// bank account. Only the request/approval workflow is tracked here; the
// actual bank transfer happens manually (admin executes it via BOG's own
// dashboard/banking after approving — see routes/adminPayouts.ts).
// ============================================================
router.post('/payout-requests', authenticate, requireRole('Student'), async (req: Request, res: Response) => {
  const result = createPayoutRequestSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { earningsBalance: true } });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (result.data.amount > user.earningsBalance) {
    return res.status(400).json({ message: 'Requested amount exceeds your available balance.' });
  }
  const pendingTotal = await prisma.payoutRequest.aggregate({
    where: { userId: req.user!.id, status: 'PENDING' },
    _sum: { amount: true },
  });
  if ((pendingTotal._sum.amount ?? 0) + result.data.amount > user.earningsBalance) {
    return res.status(400).json({ message: 'You already have pending payout requests that exceed your available balance.' });
  }

  const request = await prisma.payoutRequest.create({
    data: { userId: req.user!.id, amount: result.data.amount, iban: result.data.iban },
  });
  res.status(201).json({ data: request });
});

router.get('/payout-requests', authenticate, requireRole('Student'), async (req: Request, res: Response) => {
  const requests = await prisma.payoutRequest.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: requests });
});

export default router;
