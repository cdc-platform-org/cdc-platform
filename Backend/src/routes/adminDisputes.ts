import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { resolveDisputeSchema } from '../schemas/disputeSchemas';
import { releaseEscrow } from '../services/escrowService';
import { refundEscrow } from '../services/escrowService';
import { logAdminAction } from '../services/auditLogService';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

const userSelect = { select: { id: true, name: true, email: true } };

router.get('/', async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const disputes = await prisma.dispute.findMany({
    where: status ? { status: status as any } : undefined,
    include: {
      gig: { select: { id: true, title: true, status: true, deliveryComment: true, deliveryFiles: true, deliveryLinks: true, postedBy: userSelect, assignedFreelancer: userSelect, transaction: true } },
      raisedBy: userSelect,
      resolvedBy: userSelect,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: disputes });
});

router.get('/:id', async (req: Request, res: Response) => {
  const dispute = await prisma.dispute.findUnique({
    where: { id: req.params.id },
    include: {
      gig: { select: { id: true, title: true, description: true, status: true, deliveryComment: true, deliveryFiles: true, deliveryLinks: true, postedBy: userSelect, assignedFreelancer: userSelect, transaction: true } },
      raisedBy: userSelect,
      resolvedBy: userSelect,
    },
  });
  if (!dispute) return res.status(404).json({ message: 'Dispute not found.' });

  // Chat history between the two participants, for the admin to review.
  const messages = dispute.gig.postedBy && dispute.gig.assignedFreelancer
    ? await prisma.message.findMany({
        where: {
          OR: [
            { senderId: dispute.gig.postedBy.id, recipientId: dispute.gig.assignedFreelancer.id },
            { senderId: dispute.gig.assignedFreelancer.id, recipientId: dispute.gig.postedBy.id },
          ],
        },
        orderBy: { createdAt: 'asc' },
      })
    : [];

  res.json({ data: { ...dispute, messages } });
});

router.post('/:id/resolve', async (req: Request, res: Response) => {
  const result = resolveDisputeSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const dispute = await prisma.dispute.findUnique({ where: { id: req.params.id } });
  if (!dispute) return res.status(404).json({ message: 'Dispute not found.' });
  if (dispute.status !== 'OPEN') return res.status(400).json({ message: 'This dispute has already been resolved.' });

  try {
    if (result.data.status === 'RESOLVED_PAYOUT') {
      await releaseEscrow(dispute.gigId);
    } else if (result.data.status === 'RESOLVED_REFUND') {
      await refundEscrow(dispute.gigId);
    }
  } catch (err) {
    return res.status(400).json({ message: err instanceof Error ? err.message : 'Unable to resolve escrow for this dispute.' });
  }

  const updated = await prisma.dispute.update({
    where: { id: dispute.id },
    data: {
      status: result.data.status,
      resolution: result.data.resolution ?? null,
      resolvedById: req.user!.id,
      resolvedAt: new Date(),
    },
  });
  await logAdminAction({
    action: 'dispute.resolve',
    targetType: 'Dispute',
    targetId: dispute.id,
    performedById: req.user!.id,
    metadata: { resolution: result.data.status, gigId: dispute.gigId },
  });
  res.json({ data: updated });
});

export default router;
