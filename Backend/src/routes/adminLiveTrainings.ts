import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { logAdminAction } from '../services/auditLogService';
import { uploadImage } from '../services/imageStorage';
import { BunnyStorageUploadError } from '../services/bunnyStorage';
import {
  liveTrainingCreateSchema,
  liveTrainingUpdateSchema,
  liveTrainingLeadUpdateSchema,
} from '../schemas/liveTrainingSchemas';
import { processLiveTrainingSynopsis } from '../services/liveTrainingSynopsisService';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

// Same buffered-straight-to-Bunny pattern as adminStudioCases.ts's own
// /upload-image — a plain marketing cover photo, no Sharp processing.
const imageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image uploads are allowed.'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.post(
  '/upload-image',
  (req: Request, res: Response, next) => {
    imageUpload.single('image')(req, res, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'The photo exceeds 10MB. Please choose a smaller file.' });
      }
      return res.status(400).json({ message: err.message || 'Only image uploads are allowed.' });
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No file was selected.' });
    const filename = `live-training-${Date.now()}-${crypto.randomUUID()}${path.extname(req.file.originalname)}`;
    try {
      const url = await uploadImage({ buffer: req.file.buffer, mimetype: req.file.mimetype, folderName: 'live-trainings', filename });
      res.status(201).json({ data: { url } });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'Image upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

// Counts leads + active enrollments together — same reasoning as the
// public liveTrainings.ts's own withCapacity (two independent registration
// paths, one seat pool).
const enrollmentCountSelect = { where: { status: 'ACTIVE' as const } };

function withCapacity<T extends { minCapacity: number; maxCapacity: number; _count: { leads: number; enrollments: number } }>(training: T) {
  const { _count, ...rest } = training;
  const registeredCount = _count.leads + _count.enrollments;
  return {
    ...rest,
    registeredCount,
    seatsRemaining: Math.max(0, training.maxCapacity - registeredCount),
    isFull: registeredCount >= training.maxCapacity,
    minThresholdMet: registeredCount >= training.minCapacity,
  };
}

router.get('/', async (_req: Request, res: Response) => {
  const trainings = await prisma.liveTraining.findMany({
    include: { _count: { select: { leads: true, enrollments: enrollmentCountSelect } } },
    orderBy: { scheduledAt: 'desc' },
  });
  res.json({ data: trainings.map(withCapacity) });
});

router.post('/', async (req: Request, res: Response) => {
  const result = liveTrainingCreateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { thumbnailUrl, videoUrl, meetingUrl, classroomUrl, recordingUrl, startDate, endDate, ...rest } = result.data;
  const training = await prisma.liveTraining.create({
    data: {
      ...rest,
      thumbnailUrl: thumbnailUrl || null,
      videoUrl: videoUrl || null,
      meetingUrl: meetingUrl || null,
      classroomUrl: classroomUrl || null,
      recordingUrl: recordingUrl || null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      scheduledAt: new Date(result.data.scheduledAt),
    },
    include: { _count: { select: { leads: true, enrollments: enrollmentCountSelect } } },
  });
  await logAdminAction({ action: 'liveTraining.create', targetType: 'LiveTraining', targetId: training.id, performedById: req.user!.id });
  // Fire-and-forget — never blocks this response. See
  // liveTrainingSynopsisService.ts for the pipeline; a create with a
  // recordingUrl already attached (rare, but the schema allows it) still
  // gets a synopsis without a separate edit-and-save round trip.
  if (training.recordingUrl) {
    processLiveTrainingSynopsis(training.id, training.recordingUrl).catch((err) =>
      console.error(`[adminLiveTrainings] synopsis kickoff failed for ${training.id}:`, err)
    );
  }
  res.status(201).json({ data: withCapacity(training) });
});

router.put('/:id', async (req: Request, res: Response) => {
  const result = liveTrainingUpdateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { thumbnailUrl, videoUrl, meetingUrl, classroomUrl, recordingUrl, startDate, endDate, scheduledAt, ...rest } = result.data;
  try {
    const existing = recordingUrl !== undefined
      ? await prisma.liveTraining.findUnique({ where: { id: req.params.id }, select: { recordingUrl: true } })
      : null;

    const training = await prisma.liveTraining.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(thumbnailUrl !== undefined ? { thumbnailUrl: thumbnailUrl || null } : {}),
        ...(videoUrl !== undefined ? { videoUrl: videoUrl || null } : {}),
        ...(meetingUrl !== undefined ? { meetingUrl: meetingUrl || null } : {}),
        ...(classroomUrl !== undefined ? { classroomUrl: classroomUrl || null } : {}),
        ...(recordingUrl !== undefined ? { recordingUrl: recordingUrl || null } : {}),
        ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
        ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
        ...(scheduledAt !== undefined ? { scheduledAt: new Date(scheduledAt) } : {}),
      },
      include: { _count: { select: { leads: true, enrollments: enrollmentCountSelect } } },
    });
    await logAdminAction({ action: 'liveTraining.update', targetType: 'LiveTraining', targetId: training.id, performedById: req.user!.id });
    // Fire-and-forget, only when recordingUrl actually changed to a new
    // truthy value — never blocks this response, and never re-runs the
    // (real Gemini cost, real time) pipeline just because an admin re-saved
    // the form with the same link or edited an unrelated field.
    if (training.recordingUrl && training.recordingUrl !== existing?.recordingUrl) {
      processLiveTrainingSynopsis(training.id, training.recordingUrl).catch((err) =>
        console.error(`[adminLiveTrainings] synopsis kickoff failed for ${training.id}:`, err)
      );
    }
    res.json({ data: withCapacity(training) });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Live training not found.' });
    throw err;
  }
});

// Explicit re-run, independent of the auto-trigger in PUT above — for the
// admin UI's "✨ Regenerate AI Synopsis" button (e.g. after editing the
// recording, or retrying a FAILED run without having to re-paste the same
// URL to trip the change-detection in PUT).
router.post('/:id/regenerate-synopsis', async (req: Request, res: Response) => {
  const training = await prisma.liveTraining.findUnique({ where: { id: req.params.id }, select: { id: true, recordingUrl: true } });
  if (!training) return res.status(404).json({ message: 'Live training not found.' });
  if (!training.recordingUrl) return res.status(400).json({ message: 'This training has no recording URL set yet.' });

  processLiveTrainingSynopsis(training.id, training.recordingUrl).catch((err) =>
    console.error(`[adminLiveTrainings] synopsis regenerate failed for ${training.id}:`, err)
  );
  res.status(202).json({ data: { synopsisStatus: 'PROCESSING' } });
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.liveTraining.delete({ where: { id: req.params.id } });
    await logAdminAction({ action: 'liveTraining.delete', targetType: 'LiveTraining', targetId: req.params.id, performedById: req.user!.id });
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Live training not found.' });
    throw err;
  }
});

// ============================================================
// LEADS — per-training registration queue.
// ============================================================

router.get('/:id/leads', async (req: Request, res: Response) => {
  const leads = await prisma.liveTrainingLead.findMany({
    where: { liveTrainingId: req.params.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: leads });
});

router.patch('/leads/:leadId', async (req: Request, res: Response) => {
  const result = liveTrainingLeadUpdateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  try {
    const lead = await prisma.liveTrainingLead.update({ where: { id: req.params.leadId }, data: result.data });
    await logAdminAction({ action: 'liveTraining.lead.update', targetType: 'LiveTrainingLead', targetId: lead.id, performedById: req.user!.id });
    res.json({ data: lead });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Lead not found.' });
    throw err;
  }
});

// ============================================================
// ENROLLMENTS — the real, account-based cohort roster (distinct from the
// anonymous leads queue above). This is what a future cohort-exam builder
// or any other roster-scoped feature should read from.
// ============================================================

router.get('/:id/enrollments', async (req: Request, res: Response) => {
  const training = await prisma.liveTraining.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!training) return res.status(404).json({ message: 'Live training not found.' });

  const enrollments = await prisma.liveTrainingEnrollment.findMany({
    where: { liveTrainingId: req.params.id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { enrolledAt: 'desc' },
  });
  res.json({ data: enrollments });
});

// ============================================================
// MANUAL ENROLLMENT GRANTING — admin override for bank-transfer/offline
// payments that never went through online checkout or the self-serve free
// enroll flow. Same posture as adminFinance.ts's course-access/grant: takes
// either the student's email or their account id (whichever the admin has
// on hand — a bank transfer receipt usually only has an email), upserts
// straight to ACTIVE so re-granting a CANCELLED row reactivates it instead
// of erroring on the unique (userId, liveTrainingId) constraint.
// ============================================================
const grantEnrollmentSchema = z
  .object({
    userEmail: z.string().email().optional(),
    userId: z.string().min(1).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((data) => !!data.userEmail || !!data.userId, {
    message: 'Provide either userEmail or userId.',
    path: ['userEmail'],
  });

router.post('/:id/grant', async (req: Request, res: Response) => {
  const result = grantEnrollmentSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const [user, training] = await Promise.all([
    result.data.userId
      ? prisma.user.findUnique({ where: { id: result.data.userId } })
      : prisma.user.findUnique({ where: { email: result.data.userEmail! } }),
    prisma.liveTraining.findUnique({ where: { id: req.params.id } }),
  ]);
  if (!user) return res.status(404).json({ message: 'No user found with that email/id.' });
  if (!training) return res.status(404).json({ message: 'Live training not found.' });

  const enrollment = await prisma.liveTrainingEnrollment.upsert({
    where: { userId_liveTrainingId: { userId: user.id, liveTrainingId: training.id } },
    update: { status: 'ACTIVE' },
    create: { userId: user.id, liveTrainingId: training.id, status: 'ACTIVE' },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  await logAdminAction({
    action: 'liveTraining.enrollment.manual-grant',
    targetType: 'LiveTrainingEnrollment',
    targetId: `${user.id}:${training.id}`,
    performedById: req.user!.id,
    metadata: { note: result.data.note, trainingTitle: training.title, userEmail: user.email },
  });
  res.status(201).json({ data: enrollment });
});

// Minimal hand-rolled CSV — the export is always name/email/phone/status/
// note/date, never arbitrary user-authored columns, so a library would be
// pure overhead. Quotes every field and escapes embedded quotes, which is
// the one thing that actually needs care (a name/note with a comma or
// quote in it must not corrupt the column layout).
function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

router.get('/:id/leads/export', async (req: Request, res: Response) => {
  const training = await prisma.liveTraining.findUnique({ where: { id: req.params.id }, select: { title: true } });
  if (!training) return res.status(404).json({ message: 'Live training not found.' });

  const leads = await prisma.liveTrainingLead.findMany({
    where: { liveTrainingId: req.params.id },
    orderBy: { createdAt: 'desc' },
  });

  const header = ['Name', 'Email', 'Phone', 'Status', 'Note', 'Registered At'];
  const rows = leads.map((l) =>
    [l.name, l.email, l.phone, l.status, l.adminNote ?? '', l.createdAt.toISOString()].map(csvEscape).join(',')
  );
  const csv = [header.map(csvEscape).join(','), ...rows].join('\r\n');

  const filename = `${training.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-leads.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  // BOM so Excel (still the realistic destination for this export) renders
  // Georgian text correctly instead of mangling it as Latin-1.
  res.send('﻿' + csv);
});

export default router;
