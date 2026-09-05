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
import { createExamSessionSchema, updateExamSessionSchema } from '../schemas/examProctoringSchemas';
import { processLiveTrainingSynopsis } from '../services/liveTrainingSynopsisService';
import { grantGraduateStatus } from '../services/graduateStatusService';
import { generateExamQuestions, ExamProctoringAiError, isExamProctoringConfigured } from '../services/examProctoringService';

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

// Counts leads + non-cancelled enrollments together — same reasoning as the
// public liveTrainings.ts's own withCapacity (two independent registration
// paths, one seat pool). COMPLETED still counts: a finished cohort seat was
// still used, only CANCELLED frees it back up.
const enrollmentCountSelect = { where: { status: { not: 'CANCELLED' as const } } };

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

// AUDIT NOTE (fixed): LiveTrainingEnrollment/LiveTrainingLead both cascade-
// delete with their LiveTraining (unlike Course, where CourseEnrollment/
// Certificate/CoursePurchase are all onDelete: Restrict — a course with
// active students genuinely cannot be deleted). Deleting a training used to
// silently wipe every enrollment record, including COMPLETED ones, with no
// warning at all. Not changed to a schema-level Restrict (would need a
// migration for what's otherwise a same-session safety pass) — an
// application-level guard gets the same outcome: an admin who really wants
// to delete a training with real enrollments can still do so with
// `?force=true`, but the accidental/uninformed case is stopped cold.
router.delete('/:id', async (req: Request, res: Response) => {
  const enrollmentCount = await prisma.liveTrainingEnrollment.count({ where: { liveTrainingId: req.params.id } });
  if (enrollmentCount > 0 && req.query.force !== 'true') {
    return res.status(409).json({
      message: `This training has ${enrollmentCount} enrollment(s), including completion history. Deleting it will permanently erase them. Pass ?force=true to confirm.`,
      enrollmentCount,
    });
  }
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

// ============================================================
// COMPLETION — marks a cohort seat as finished, and as a side effect grants
// CDC Graduate status (isVerifiedGraduate — unlimited forum posting, the
// Employment Forum) plus a congrats notification/email. See
// graduateStatusService.grantGraduateStatus; idempotent for a student who
// is already a graduate from an earlier course exam pass.
// ============================================================
async function completeEnrollment(
  enrollment: { id: string; userId: string; liveTrainingId: string; status: string },
  trainingTitle: string,
  performedById: string
) {
  const updated = await prisma.liveTrainingEnrollment.update({
    where: { id: enrollment.id },
    data: { status: 'COMPLETED', completedAt: new Date() },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  await logAdminAction({
    action: 'liveTraining.enrollment.complete',
    targetType: 'LiveTrainingEnrollment',
    targetId: enrollment.id,
    performedById,
    metadata: { trainingTitle, userId: enrollment.userId },
  });
  await grantGraduateStatus(enrollment.userId, performedById, 'live_training_completed', {
    liveTrainingId: enrollment.liveTrainingId,
    trainingTitle,
  });
  return updated;
}

router.post('/:id/enrollments/:enrollmentId/complete', async (req: Request, res: Response) => {
  const [enrollment, training] = await Promise.all([
    prisma.liveTrainingEnrollment.findUnique({ where: { id: req.params.enrollmentId } }),
    prisma.liveTraining.findUnique({ where: { id: req.params.id }, select: { title: true } }),
  ]);
  if (!enrollment || enrollment.liveTrainingId !== req.params.id) {
    return res.status(404).json({ message: 'Enrollment not found.' });
  }
  if (!training) return res.status(404).json({ message: 'Live training not found.' });
  if (enrollment.status === 'COMPLETED') {
    return res.status(400).json({ message: 'This enrollment is already marked completed.' });
  }

  const updated = await completeEnrollment(enrollment, training.title, req.user!.id);
  res.json({ data: updated });
});

// Bulk variant for the common case — a whole cohort finishes on the same
// date. Only touches ACTIVE rows; a CANCELLED enrollment is never silently
// resurrected into COMPLETED.
router.post('/:id/complete-all', async (req: Request, res: Response) => {
  const training = await prisma.liveTraining.findUnique({ where: { id: req.params.id }, select: { title: true } });
  if (!training) return res.status(404).json({ message: 'Live training not found.' });

  const active = await prisma.liveTrainingEnrollment.findMany({
    where: { liveTrainingId: req.params.id, status: 'ACTIVE' },
  });

  const completed = [];
  for (const enrollment of active) {
    completed.push(await completeEnrollment(enrollment, training.title, req.user!.id));
  }
  res.json({ data: { completedCount: completed.length } });
});

// ============================================================
// FINAL EXAM — reuses the same AI question generator and candidate-token
// link mechanism as the standalone Business exam-proctoring tool
// (routes/examProctoring.ts), just created here so a SUPER_ADMIN/MANAGER
// admin (who has no Client-role account) can generate and share a cohort's
// final exam directly from this panel. The public candidate-facing routes
// under /exam-proctoring/candidate/:token already work unmodified for a
// session created this way.
// ============================================================
router.get('/:id/exam-sessions', async (req: Request, res: Response) => {
  const sessions = await prisma.examSession.findMany({
    where: { liveTrainingId: req.params.id },
    include: { _count: { select: { submissions: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: sessions });
});

router.post('/:id/exam-sessions', async (req: Request, res: Response) => {
  if (!isExamProctoringConfigured()) {
    return res.status(501).json({ message: 'AI Exam generation is not configured on this server.' });
  }
  const training = await prisma.liveTraining.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!training) return res.status(404).json({ message: 'Live training not found.' });

  const result = createExamSessionSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  let generated;
  try {
    generated = await generateExamQuestions({
      topic: result.data.topic,
      mcqCount: result.data.mcqCount,
      rawContent: result.data.rawContent,
      includeCodeQuestion: result.data.includeCodeQuestion,
    });
  } catch (err) {
    const message = err instanceof ExamProctoringAiError ? err.message : 'Failed to generate exam questions.';
    const status = err instanceof ExamProctoringAiError ? err.status : 502;
    return res.status(status).json({ message });
  }

  const session = await prisma.examSession.create({
    data: {
      businessId: req.user!.id,
      liveTrainingId: training.id,
      title: result.data.title,
      description: result.data.description ?? null,
      topic: result.data.topic,
      rawContent: result.data.rawContent ?? null,
      mcqCount: result.data.mcqCount,
      durationMinutes: result.data.durationMinutes,
      questions: {
        create: generated.map((q) => ({
          order: q.order,
          type: q.type,
          question: q.question,
          options: q.type === 'MCQ' ? q.options : undefined,
          correctAnswer: q.type === 'MCQ' ? q.correctAnswer : q.rubric,
        })),
      },
    },
    include: { questions: { orderBy: { order: 'asc' } } },
  });
  await logAdminAction({
    action: 'liveTraining.examSession.create',
    targetType: 'ExamSession',
    targetId: session.id,
    performedById: req.user!.id,
    metadata: { liveTrainingId: training.id, title: session.title },
  });
  res.status(201).json({ data: session });
});

async function loadTrainingExamSession(trainingId: string, sessionId: string) {
  const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
  if (!session || session.liveTrainingId !== trainingId) return null;
  return session;
}

router.patch('/:id/exam-sessions/:sessionId', async (req: Request, res: Response) => {
  const session = await loadTrainingExamSession(req.params.id, req.params.sessionId);
  if (!session) return res.status(404).json({ message: 'Exam session not found.' });

  const result = updateExamSessionSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const updated = await prisma.examSession.update({ where: { id: session.id }, data: result.data });
  res.json({ data: updated });
});

router.delete('/:id/exam-sessions/:sessionId', async (req: Request, res: Response) => {
  const session = await loadTrainingExamSession(req.params.id, req.params.sessionId);
  if (!session) return res.status(404).json({ message: 'Exam session not found.' });

  await prisma.examSession.delete({ where: { id: session.id } });
  res.status(204).send();
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
