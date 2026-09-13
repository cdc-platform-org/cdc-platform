import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole, requireNotBannedOrDeleted } from '../middleware/auth';
import { logAdminAction } from '../services/auditLogService';

// ============================================================
// IAKO Trainer Tools — global Trainer roster (SUPER_ADMIN/MANAGER only).
//
// Enables/disables the Trainer *capability* on an existing User account.
// Deliberately separate from:
//  - /admin/team (AdminRole tiers — internal admin-panel access)
//  - /admin/team-trainers (marketing TeamMember bios — no login at all)
//  - the Mentor role (unrelated gig-marketplace/course-instructor concept)
// Per-training assignment lives in adminLiveTrainingTrainers.ts; this file
// only manages the roster of accounts eligible to be assigned at all.
// ============================================================

const router = Router();
router.use(authenticate, requireNotBannedOrDeleted, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

router.get('/', async (_req: Request, res: Response) => {
  const trainers = await prisma.trainerProfile.findMany({
    include: { user: { select: { id: true, name: true, email: true } }, _count: { select: { assignments: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: trainers });
});

const createTrainerSchema = z.object({ userId: z.string().min(1) });

router.post('/', async (req: Request, res: Response) => {
  const result = createTrainerSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const user = await prisma.user.findUnique({ where: { id: result.data.userId }, select: { id: true, name: true, email: true } });
  if (!user) return res.status(404).json({ message: 'No user found with that id.' });

  const existing = await prisma.trainerProfile.findUnique({ where: { userId: user.id } });
  if (existing?.active) return res.status(409).json({ message: `${user.name} is already an active Trainer.` });

  const profile = existing
    ? await prisma.trainerProfile.update({ where: { id: existing.id }, data: { active: true }, include: { user: { select: { id: true, name: true, email: true } } } })
    : await prisma.trainerProfile.create({ data: { userId: user.id }, include: { user: { select: { id: true, name: true, email: true } } } });

  await logAdminAction({ action: 'trainer.profile.enabled', targetType: 'TrainerProfile', targetId: profile.id, performedById: req.user!.id, metadata: { userId: user.id } });
  res.status(201).json({ data: profile });
});

const updateTrainerSchema = z.object({ active: z.boolean() });

router.patch('/:id', async (req: Request, res: Response) => {
  const result = updateTrainerSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  try {
    const profile = await prisma.trainerProfile.update({
      where: { id: req.params.id },
      data: { active: result.data.active },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    await logAdminAction({
      action: result.data.active ? 'trainer.profile.enabled' : 'trainer.profile.disabled',
      targetType: 'TrainerProfile', targetId: profile.id, performedById: req.user!.id,
    });
    res.json({ data: profile });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Trainer profile not found.' });
    throw err;
  }
});

export default router;
