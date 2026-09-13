import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireNotBannedOrDeleted } from '../middleware/auth';
import { requireTrainer, requireAssignedTraining, TrainerAccessError } from '../services/trainerAuthService';
import { getTrainingGuides, getGuideMetrics, TrainingGuideError } from '../services/trainingGuideService';
import { trainingDaySchema } from '../schemas/trainingGuideSchemas';
import { videoUpload, multerErrorHandler } from '../middleware/productUploads';
import { uploadImage } from '../services/imageStorage';
import { BunnyStorageUploadError } from '../services/bunnyStorage';

// ============================================================
// IAKO Trainer Tools — authenticated Trainer workspace (Phase 1 MVP).
//
// Every route below is scoped to "trainings THIS trainer is assigned to" —
// there is no path from this file to another trainer's training, its
// participants, or its guides (see requireAssignedTraining's own comment).
// Nothing here reuses an admin endpoint wholesale: each route was written
// from scratch to expose only what a trainer running their own cohort
// needs, never the broader authority the /admin/live-trainings equivalents
// carry (bulk delete, pricing, exam generation, cross-training settings).
// ============================================================

// Same non-cancelled-still-counts convention as adminLiveTrainings.ts's own
// enrollmentCountSelect.
const enrollmentCountSelect = { where: { status: { not: 'CANCELLED' as const } } };

const router = Router();
router.use(authenticate, requireNotBannedOrDeleted);

// Unauthenticated-as-a-Trainer callers get { isTrainer: false } here, not a
// 403 — this is the frontend's own gate check (TrainerGate), which needs to
// tell "not a trainer" apart from "network error" without every non-trainer
// visitor to /dashboard tripping a console error.
router.get('/me', async (req: Request, res: Response) => {
  const profile = await prisma.trainerProfile.findUnique({ where: { userId: req.user!.id } });
  if (!profile || !profile.active) return res.json({ data: { isTrainer: false } });
  res.json({ data: { isTrainer: true, id: profile.id, createdAt: profile.createdAt } });
});

router.use(requireTrainer);

function handleTrainerError(err: unknown, res: Response) {
  if (err instanceof TrainerAccessError || err instanceof TrainingGuideError) {
    return res.status(err.status).json({ message: err.message });
  }
  throw err;
}

// ============================================================
// MY LIVE TRAININGS
// ============================================================
router.get('/live-trainings', async (req: Request, res: Response) => {
  const assignments = await prisma.liveTrainingTrainerAssignment.findMany({
    where: { trainerProfileId: req.trainerProfileId! },
    include: { liveTraining: { include: { _count: { select: { enrollments: enrollmentCountSelect } } } } },
    orderBy: { liveTraining: { scheduledAt: 'desc' } },
  });
  const data = assignments.map((a) => {
    const { _count, ...training } = a.liveTraining;
    return { ...training, participantCount: _count.enrollments, assignedAt: a.createdAt };
  });
  res.json({ data });
});

async function loadAssignedTraining(req: Request) {
  await requireAssignedTraining(req.trainerProfileId!, req.params.id);
  const training = await prisma.liveTraining.findUnique({ where: { id: req.params.id } });
  if (!training) throw new TrainerAccessError(404, 'Live training not found.');
  return training;
}

router.get('/live-trainings/:id', async (req: Request, res: Response) => {
  try {
    res.json({ data: await loadAssignedTraining(req) });
  } catch (err) {
    handleTrainerError(err, res);
  }
});

// ============================================================
// PARTICIPANTS — the exact same minimal user shape (id/name/email) as the
// admin roster in adminLiveTrainingEnrollments.ts's own GET /:trainingId/
// enrollments; nothing beyond what's needed to identify and contact a
// participant during the training is ever included here.
// ============================================================
router.get('/live-trainings/:id/participants', async (req: Request, res: Response) => {
  try {
    await requireAssignedTraining(req.trainerProfileId!, req.params.id);
    const enrollments = await prisma.liveTrainingEnrollment.findMany({
      where: { liveTrainingId: req.params.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { enrolledAt: 'desc' },
    });
    res.json({ data: enrollments });
  } catch (err) {
    handleTrainerError(err, res);
  }
});

// ============================================================
// DAILY GUIDES / MATERIALS — full read access (same elevated view as
// admin: unpublished days included, no enrollment check), but write access
// is deliberately narrower than adminTrainingGuides.ts: a trainer may edit
// a day's own content (title/summary/sections/published/sourcePages), but
// may not renumber/move a day (that ripples into guide settings and
// reference-source day links elsewhere — see adminTrainingGuides.ts's PUT
// handler), create/delete days, reorder, change pause/visibility/timezone
// settings, manage reference sources, or set attendanceFormUrl/
// feedbackFormUrl (Google Form links stay an admin-configured, training-
// operations concern). Those stay admin-only for Phase 1.
// ============================================================
router.get('/live-trainings/:id/guides', async (req: Request, res: Response) => {
  try {
    await requireAssignedTraining(req.trainerProfileId!, req.params.id);
    const guides = await getTrainingGuides(req.params.id, req.user!.id, true);
    const days = await prisma.trainingDay.findMany({ where: { liveTrainingId: req.params.id }, orderBy: { dayNumber: 'asc' } });
    const metrics = await getGuideMetrics(req.params.id, days);
    res.json({ data: { ...guides, metrics } });
  } catch (err) {
    handleTrainerError(err, res);
  }
});

router.put('/live-trainings/:id/guides/days/:dayId', async (req: Request, res: Response) => {
  const result = trainingDaySchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  try {
    await requireAssignedTraining(req.trainerProfileId!, req.params.id);
    const trainingId = req.params.id;
    const day = await prisma.$transaction(async (tx) => {
      const existing = await tx.trainingDay.findFirst({ where: { id: req.params.dayId, liveTrainingId: trainingId } });
      if (!existing) throw new TrainerAccessError(404, 'Guide not found.');
      if (existing.dayNumber !== result.data.dayNumber) {
        throw new TrainerAccessError(400, 'Trainers cannot renumber or move training days — ask an admin.');
      }
      const itemIds = result.data.sections.flatMap((section) => section.items.map((item) => item.id));
      await tx.trainingDayProgress.deleteMany({ where: { dayId: existing.id, itemId: { notIn: itemIds } } });
      // Attendance/Feedback form links stay admin-only, same posture as the
      // dayNumber guard above — a trainer's write never touches them
      // regardless of what the payload carries.
      return tx.trainingDay.update({ where: { id: existing.id }, data: {
        ...result.data, sections: result.data.sections as Prisma.InputJsonValue,
        attendanceFormUrl: existing.attendanceFormUrl, feedbackFormUrl: existing.feedbackFormUrl,
      } });
    });
    res.json({ data: day });
  } catch (err) {
    handleTrainerError(err, res);
  }
});

// ============================================================
// TRAINER VIDEO — reuses the exact upload middleware/storage as
// DigitalProduct.previewVideoUrl (productUploads.ts's videoUpload + Bunny
// via imageStorage.ts's uploadImage): a public marketing-style clip, no new
// storage system. Scoped to LiveTraining.trainerVideoUrl only — no other
// field on this row is writable from this endpoint.
// ============================================================
router.post(
  '/live-trainings/:id/trainer-video',
  (req: Request, res: Response, next: NextFunction) => videoUpload.single('video')(req, res, (err: any) => multerErrorHandler(req, res, err, next)),
  async (req: Request, res: Response) => {
    try {
      await requireAssignedTraining(req.trainerProfileId!, req.params.id);
      if (!req.file) return res.status(400).json({ message: 'No file was selected.' });
      const filename = `trainer-video-${Date.now()}-${crypto.randomUUID()}${path.extname(req.file.originalname)}`;
      const url = await uploadImage({ buffer: req.file.buffer, mimetype: req.file.mimetype, folderName: 'trainer-videos', filename });
      const training = await prisma.liveTraining.update({ where: { id: req.params.id }, data: { trainerVideoUrl: url }, select: { id: true, trainerVideoUrl: true } });
      res.status(201).json({ data: training });
    } catch (err) {
      if (err instanceof BunnyStorageUploadError) return res.status(500).json({ message: err.message });
      handleTrainerError(err, res);
    }
  }
);

router.delete('/live-trainings/:id/trainer-video', async (req: Request, res: Response) => {
  try {
    await requireAssignedTraining(req.trainerProfileId!, req.params.id);
    const training = await prisma.liveTraining.update({ where: { id: req.params.id }, data: { trainerVideoUrl: null }, select: { id: true, trainerVideoUrl: true } });
    res.json({ data: training });
  } catch (err) {
    handleTrainerError(err, res);
  }
});

export default router;
