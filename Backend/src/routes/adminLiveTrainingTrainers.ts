import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole, requireNotBannedOrDeleted } from '../middleware/auth';
import { logAdminAction } from '../services/auditLogService';

// ============================================================
// IAKO Trainer Tools — per-training trainer assignment (SUPER_ADMIN/MANAGER
// only). Same "resolve the parent training once, guard every sub-route"
// shape as adminLiveTrainingEnrollments.ts, mounted at the same
// /api/admin/live-trainings base.
// ============================================================

const router = Router();
router.use('/:trainingId/trainers', authenticate, requireNotBannedOrDeleted, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req, res, next) => {
  const training = await prisma.liveTraining.findUnique({ where: { id: req.params.trainingId }, select: { id: true } });
  if (!training) return res.status(404).json({ message: 'Training not found.' });
  next();
});

router.get('/:trainingId/trainers', async (req: Request, res: Response) => {
  const assignments = await prisma.liveTrainingTrainerAssignment.findMany({
    where: { liveTrainingId: req.params.trainingId },
    include: { trainerProfile: { include: { user: { select: { id: true, name: true, email: true } } } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ data: assignments });
});

const assignSchema = z.object({ trainerProfileId: z.string().min(1) });

router.post('/:trainingId/trainers', async (req: Request, res: Response) => {
  const result = assignSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const trainer = await prisma.trainerProfile.findUnique({ where: { id: result.data.trainerProfileId } });
  if (!trainer || !trainer.active) return res.status(404).json({ message: 'Active trainer profile not found.' });

  try {
    const assignment = await prisma.liveTrainingTrainerAssignment.create({
      data: { trainerProfileId: trainer.id, liveTrainingId: req.params.trainingId, assignedById: req.user!.id },
      include: { trainerProfile: { include: { user: { select: { id: true, name: true, email: true } } } } },
    });
    await logAdminAction({
      action: 'liveTraining.trainer.assigned', targetType: 'LIVE_TRAINING', targetId: req.params.trainingId,
      performedById: req.user!.id, metadata: { trainerProfileId: trainer.id, userId: trainer.userId },
    });
    res.status(201).json({ data: assignment });
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ message: 'This trainer is already assigned to this training.' });
    throw err;
  }
});

router.delete('/:trainingId/trainers/:assignmentId', async (req: Request, res: Response) => {
  const { count } = await prisma.liveTrainingTrainerAssignment.deleteMany({
    where: { id: req.params.assignmentId, liveTrainingId: req.params.trainingId },
  });
  if (!count) return res.status(404).json({ message: 'Assignment not found.' });
  await logAdminAction({
    action: 'liveTraining.trainer.removed', targetType: 'LIVE_TRAINING', targetId: req.params.trainingId,
    performedById: req.user!.id, metadata: { assignmentId: req.params.assignmentId },
  });
  res.json({ data: { saved: true } });
});

export default router;
