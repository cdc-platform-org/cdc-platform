import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { assignHRSpecialistSchema, resolveHRSupportDisputeSchema } from '../schemas/hrSupportSchemas';
import { resolveHRSupportDispute } from '../services/hrSupportEscrowService';
import { logAdminAction } from '../services/auditLogService';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

const specialistSelect = { select: { id: true, name: true, email: true } };

router.get('/', async (_req: Request, res: Response) => {
  const requests = await prisma.hRSupportRequest.findMany({
    include: {
      vacancy: { select: { id: true, title: true } },
      requestedBy: { select: { id: true, name: true, email: true } },
      assignedSpecialist: specialistSelect,
      _count: { select: { candidateEvaluations: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(requests);
});

// Accounts eligible for assignment — for the assign-specialist dropdown.
router.get('/specialists', async (_req: Request, res: Response) => {
  const specialists = await prisma.user.findMany({
    where: { isHrSpecialist: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  });
  res.json(specialists);
});

router.post('/:id/assign', async (req: Request, res: Response) => {
  const result = assignHRSpecialistSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const specialist = await prisma.user.findUnique({ where: { id: result.data.specialistId } });
  if (!specialist || !specialist.isHrSpecialist) {
    return res.status(400).json({ message: 'That user is not an HR specialist.' });
  }
  const request = await prisma.hRSupportRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ message: 'HR Assistance request not found.' });
  if (request.escrowStatus !== 'HELD_IN_ESCROW') {
    return res.status(400).json({ message: 'This request has no funds held in escrow to assign work against.' });
  }

  const updated = await prisma.hRSupportRequest.update({
    where: { id: request.id },
    data: { assignedSpecialistId: specialist.id, assignedAt: new Date(), status: 'IN_PROGRESS' },
    include: { vacancy: { select: { id: true, title: true } }, assignedSpecialist: specialistSelect },
  });
  await logAdminAction({
    action: 'hr-support.assign',
    targetType: 'HRSupportRequest',
    targetId: request.id,
    performedById: req.user!.id,
  });
  res.json(updated);
});

router.post('/:id/dispute/resolve', async (req: Request, res: Response) => {
  const result = resolveHRSupportDisputeSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const request = await prisma.hRSupportRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ message: 'HR Assistance request not found.' });
  if (!request.disputeRaisedAt || request.disputeResolvedAt) {
    return res.status(400).json({ message: 'This request has no open dispute.' });
  }

  await resolveHRSupportDispute(request.id, result.data.resolution);
  await logAdminAction({
    action: `hr-support.dispute.${result.data.resolution.toLowerCase()}`,
    targetType: 'HRSupportRequest',
    targetId: request.id,
    performedById: req.user!.id,
  });
  const updated = await prisma.hRSupportRequest.findUnique({ where: { id: request.id } });
  res.json(updated);
});

export default router;
