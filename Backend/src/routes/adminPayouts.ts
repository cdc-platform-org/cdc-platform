import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { reviewPayoutRequestSchema } from '../schemas/payoutSchemas';
import { logAdminAction } from '../services/auditLogService';

const router = Router();
// Payout approvals are SUPER_ADMIN only per the RBAC hierarchy.
router.use(authenticate, requireAdminRole('SUPER_ADMIN'));

// Thrown when the atomic claim below finds the request was already
// resolved (approved/rejected) by a concurrent request between our
// advisory read and the transaction — the safe, expected loser path for
// the race this route used to be vulnerable to, not a real server error.
class PayoutAlreadyResolvedError extends Error {}

const userSelect = { select: { id: true, name: true, email: true, earningsBalance: true } };

router.get('/', async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const requests = await prisma.payoutRequest.findMany({
    where: status ? { status: status as any } : undefined,
    include: { user: userSelect, reviewedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: requests });
});

router.post('/:id/approve', async (req: Request, res: Response) => {
  const result = reviewPayoutRequestSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const request = await prisma.payoutRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ message: 'Payout request not found.' });
  if (request.status !== 'PENDING') return res.status(400).json({ message: 'This request has already been reviewed.' });

  const user = await prisma.user.findUnique({ where: { id: request.userId }, select: { earningsBalance: true } });
  if (!user || user.earningsBalance < request.amount) {
    return res.status(400).json({ message: "The student's balance no longer covers this request." });
  }

  let updatedRequest;
  try {
    updatedRequest = await prisma.$transaction(async (tx) => {
      // Atomically claim the request — if a concurrent approve/reject for
      // this same request already landed between our PENDING read above and
      // here, claim.count is 0 and we abort instead of double-debiting.
      const claim = await tx.payoutRequest.updateMany({
        where: { id: request.id, status: 'PENDING' },
        data: { status: 'APPROVED', adminNote: result.data.adminNote, reviewedById: req.user!.id, resolvedAt: new Date() },
      });
      if (claim.count === 0) {
        throw new PayoutAlreadyResolvedError();
      }
      // Atomic decrement — was previously a read-then-write
      // (earningsBalance - amount), a lost-update race if two different
      // pending requests for the same student were approved concurrently.
      const updatedUser = await tx.user.update({
        where: { id: request.userId },
        data: { earningsBalance: { decrement: request.amount } },
      });
      await tx.walletEntry.create({
        data: { userId: request.userId, type: 'PAYOUT_DEBIT', amount: -request.amount, balanceAfter: updatedUser.earningsBalance },
      });
      return tx.payoutRequest.findUniqueOrThrow({ where: { id: request.id } });
    });
  } catch (err) {
    if (err instanceof PayoutAlreadyResolvedError) {
      return res.status(400).json({ message: 'This request has already been reviewed.' });
    }
    throw err;
  }

  await logAdminAction({
    action: 'payout.approve',
    targetType: 'PayoutRequest',
    targetId: request.id,
    performedById: req.user!.id,
    metadata: { userId: request.userId, amount: request.amount, iban: request.iban },
  });
  res.json({
    data: updatedRequest,
    message: 'Approved. Wallet debited — now wire the actual bank transfer to the student\'s IBAN via BOG.',
  });
});

router.post('/:id/reject', async (req: Request, res: Response) => {
  const result = reviewPayoutRequestSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const request = await prisma.payoutRequest
    .update({
      where: { id: req.params.id },
      data: { status: 'REJECTED', adminNote: result.data.adminNote, reviewedById: req.user!.id, resolvedAt: new Date() },
    })
    .catch(() => null);
  if (!request) return res.status(404).json({ message: 'Payout request not found.' });

  await logAdminAction({ action: 'payout.reject', targetType: 'PayoutRequest', targetId: request.id, performedById: req.user!.id });
  res.json({ data: request });
});

// Mark as actually wired, after the admin sends the bank transfer manually.
router.post('/:id/mark-paid', async (req: Request, res: Response) => {
  const request = await prisma.payoutRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ message: 'Payout request not found.' });
  if (request.status !== 'APPROVED') return res.status(400).json({ message: 'Only approved requests can be marked as paid.' });

  const updated = await prisma.payoutRequest.update({ where: { id: request.id }, data: { status: 'PAID' } });
  await logAdminAction({ action: 'payout.mark-paid', targetType: 'PayoutRequest', targetId: request.id, performedById: req.user!.id });
  res.json({ data: updated });
});

export default router;
