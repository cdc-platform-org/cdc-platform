import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { createPayoutRequestSchema } from '../schemas/payoutSchemas';
const router = Router();

// Carries an HTTP status + message out of the Serializable transaction
// below — thrown inside the callback aborts the transaction (no partial
// writes) and is caught after, instead of leaving the check-then-insert
// as separate non-transactional steps a concurrent request could race.
class PayoutRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
router.get('/me', authenticate, requireRole('Student', 'Mentor'), async (req: Request, res: Response) => {
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
router.post('/payout-requests', authenticate, requireRole('Student', 'Mentor'), async (req: Request, res: Response) => {
  const result = createPayoutRequestSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  // The balance check and the request insert used to be separate,
  // non-transactional steps — two concurrent requests (double-click, or a
  // scripted attack) could both read the same pre-insert pendingTotal, both
  // pass the <= earningsBalance check, and both get created, letting a
  // student's pending payouts jointly exceed their real balance. Serializable
  // isolation makes Postgres abort one of two conflicting transactions
  // instead of letting both succeed.
  try {
    const request = await prisma.$transaction(
      async (tx) => {
        const user = await tx.user.findUnique({ where: { id: req.user!.id }, select: { earningsBalance: true, payoutIban: true } });
        if (!user) throw new PayoutRequestError(404, 'User not found.');
        const iban = result.data.iban || user.payoutIban;
        if (!iban) {
          throw new PayoutRequestError(400, 'Add an IBAN in your account settings, or provide one with this request.');
        }
        if (result.data.amount > user.earningsBalance) {
          throw new PayoutRequestError(400, 'Requested amount exceeds your available balance.');
        }
        const pendingTotal = await tx.payoutRequest.aggregate({
          where: { userId: req.user!.id, status: 'PENDING' },
          _sum: { amount: true },
        });
        if ((pendingTotal._sum.amount ?? 0) + result.data.amount > user.earningsBalance) {
          throw new PayoutRequestError(400, 'You already have pending payout requests that exceed your available balance.');
        }
        return tx.payoutRequest.create({ data: { userId: req.user!.id, amount: result.data.amount, iban } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    res.status(201).json({ data: request });
  } catch (err) {
    if (err instanceof PayoutRequestError) {
      return res.status(err.status).json({ message: err.message });
    }
    // P2034 = Postgres aborted this transaction to resolve a serialization
    // conflict with a concurrent one — the safe, expected outcome of the
    // race described above, not a real server error. The loser just retries.
    if ((err as { code?: string })?.code === 'P2034') {
      return res.status(409).json({ message: 'Please try again.' });
    }
    throw err;
  }
});

router.get('/payout-requests', authenticate, requireRole('Student', 'Mentor'), async (req: Request, res: Response) => {
  const requests = await prisma.payoutRequest.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: requests });
});

export default router;
