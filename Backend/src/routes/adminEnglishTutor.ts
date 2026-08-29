import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import {
  generateTutorLesson,
  isEnglishTutorConfigured,
  EnglishTutorError,
  CefrLevel,
  TutorTaskType,
} from '../services/englishTutorService';
import { TUTOR_SUBSCRIPTION_PRICE_GEL } from '../services/englishTutorSubscriptionService';

// ============================================================
// Admin Governance & Analytics Dashboard for the AI English Tutor (IMIAKO)
// — Frontend's /admin/tutor. English-only, same posture as admin/finance.tsx
// and the other admin-only pages this codebase already ships without a
// bilingual dict (see project memory: "admin-only, low impact").
// ============================================================

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

const TASK_TYPES = ['READING', 'WRITING', 'GRAMMAR', 'VOCABULARY', 'QUIZ', 'LISTENING', 'DIALOGUE'] as const;
const LEARNING_GOALS = ['TRAVEL', 'TECHNICAL_IT', 'BUSINESS', 'ACADEMIC', 'GENERAL_DAILY', 'INTERVIEW_PREP'] as const;

// ============================================================
// ANALYTICS
// ============================================================
router.get('/analytics', async (_req: Request, res: Response) => {
  const [activeProSubscribers, everStartedTrial, totalUsers] = await Promise.all([
    prisma.user.count({ where: { tutorSubscriptionTier: 'PRO' } }),
    prisma.user.count({ where: { tutorTrialStartDate: { not: null } } }),
    prisma.user.count(),
  ]);

  // Conversion = of everyone who ever started the cardless trial, how many
  // are PRO right now (a real purchase, or an admin-team free bypass —
  // both flip tutorSubscriptionTier the same way). Simple, real, and
  // directly answerable from existing columns — no separate funnel table
  // needed for this phase.
  const convertedFromTrial = await prisma.user.count({
    where: { tutorTrialStartDate: { not: null }, tutorSubscriptionTier: 'PRO' },
  });
  const conversionRate = everStartedTrial > 0 ? convertedFromTrial / everStartedTrial : 0;

  // Revenue — sum of COMPLETED payments (both gateways) for this purpose.
  // Stripe amounts are converted-currency (USD/EUR) minor units; amountGel
  // is the real GEL-tetri gross, same "always sum amountGel, never the raw
  // Stripe `amount`" rule as every other cross-gateway revenue query in
  // this codebase (see StripePayment.amountGel's own schema comment).
  const [bogRevenue, stripeRevenue] = await Promise.all([
    prisma.bogPayment.aggregate({
      where: { purpose: 'ENGLISH_TUTOR_SUBSCRIPTION', status: 'COMPLETED' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.stripePayment.aggregate({
      where: { purpose: 'ENGLISH_TUTOR_SUBSCRIPTION', status: 'COMPLETED' },
      _sum: { amountGel: true },
      _count: true,
    }),
  ]);
  const revenueGel = (bogRevenue._sum.amount ?? 0) + (stripeRevenue._sum.amountGel ?? 0);
  const totalPurchases = bogRevenue._count + stripeRevenue._count;

  // Completion rate + average score per learning goal — computed off
  // UserTutorProgress rows joined to their parent TutorLesson.learningGoal
  // (stamped at generation time), grouped in application code since the
  // grouping key spans two tables and this dataset is small enough that a
  // raw groupBy roundtrip isn't worth the added complexity here.
  const progressWithGoal = await prisma.userTutorProgress.findMany({
    select: { status: true, score: true, tutorLesson: { select: { learningGoal: true } } },
  });
  const perGoal: Record<string, { total: number; completed: number; scoreSum: number; scoreCount: number }> = {};
  for (const goal of LEARNING_GOALS) perGoal[goal] = { total: 0, completed: 0, scoreSum: 0, scoreCount: 0 };
  for (const p of progressWithGoal) {
    const goal = p.tutorLesson.learningGoal;
    if (!goal || !perGoal[goal]) continue;
    perGoal[goal].total += 1;
    if (p.status === 'COMPLETED') perGoal[goal].completed += 1;
    if (p.score != null) {
      perGoal[goal].scoreSum += p.score;
      perGoal[goal].scoreCount += 1;
    }
  }
  const goalStats = LEARNING_GOALS.map((goal) => ({
    goal,
    totalTasks: perGoal[goal].total,
    completionRate: perGoal[goal].total > 0 ? perGoal[goal].completed / perGoal[goal].total : 0,
    averageScore: perGoal[goal].scoreCount > 0 ? Math.round(perGoal[goal].scoreSum / perGoal[goal].scoreCount) : null,
  }));

  const overallScoreAgg = await prisma.userTutorProgress.aggregate({ _avg: { score: true }, where: { score: { not: null } } });

  res.json({
    data: {
      activeProSubscribers,
      totalUsers,
      everStartedTrial,
      conversionRate,
      revenueGel,
      totalPurchases,
      subscriptionPriceGel: TUTOR_SUBSCRIPTION_PRICE_GEL,
      averageScoreOverall: overallScoreAgg._avg.score != null ? Math.round(overallScoreAgg._avg.score) : null,
      goalStats,
    },
  });
});

// ============================================================
// CURRICULUM INSPECTOR — view/edit/approve/regenerate any AI-generated
// lesson.
// ============================================================
const listLessonsQuery = z.object({
  taskType: z.enum(TASK_TYPES).optional(),
  learningGoal: z.enum(LEARNING_GOALS).optional(),
  adminApproved: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
});
const LESSONS_PAGE_SIZE = 25;

router.get('/lessons', async (req: Request, res: Response) => {
  const result = listLessonsQuery.safeParse(req.query);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { taskType, learningGoal, adminApproved, page } = result.data;

  const where = {
    ...(taskType ? { taskType } : {}),
    ...(learningGoal ? { learningGoal } : {}),
    ...(adminApproved !== undefined ? { adminApproved: adminApproved === 'true' } : {}),
  };

  const [lessons, total] = await Promise.all([
    prisma.tutorLesson.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * LESSONS_PAGE_SIZE,
      take: LESSONS_PAGE_SIZE,
      select: {
        id: true,
        taskType: true,
        level: true,
        nativeLang: true,
        topic: true,
        learningGoal: true,
        isPro: true,
        adminApproved: true,
        adminEdited: true,
        createdAt: true,
        generatedForUser: { select: { id: true, name: true, email: true } },
        _count: { select: { flags: true } },
      },
    }),
    prisma.tutorLesson.count({ where }),
  ]);
  res.json({ data: lessons, meta: { total, page, pageSize: LESSONS_PAGE_SIZE } });
});

router.get('/lessons/:id', async (req: Request, res: Response) => {
  const lesson = await prisma.tutorLesson.findUnique({
    where: { id: req.params.id },
    include: { generatedForUser: { select: { id: true, name: true, email: true } }, flags: true },
  });
  if (!lesson) return res.status(404).json({ message: 'Lesson not found.' });
  res.json({ data: lesson });
});

const editLessonSchema = z.object({ content: z.record(z.string(), z.unknown()) });

router.put('/lessons/:id', async (req: Request, res: Response) => {
  const result = editLessonSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const existing = await prisma.tutorLesson.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Lesson not found.' });

  const lesson = await prisma.tutorLesson.update({
    where: { id: req.params.id },
    data: { content: result.data.content as any, adminEdited: true },
  });
  res.json({ data: lesson });
});

router.post('/lessons/:id/approve', async (req: Request, res: Response) => {
  const existing = await prisma.tutorLesson.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Lesson not found.' });
  const lesson = await prisma.tutorLesson.update({
    where: { id: req.params.id },
    data: { adminApproved: true, adminReviewedAt: new Date(), adminReviewedById: req.user!.id },
  });
  res.json({ data: lesson });
});

// Re-runs the exact same taskType/level/nativeLang/topic/learningGoal
// generation and REPLACES this lesson's content — same lesson id, so any
// student who already has this lesson open sees the new content on
// refresh (there is no history of the previous AI draft kept, same posture
// as courseSaleService-adjacent content elsewhere in this codebase that
// treats "replace, don't version" as acceptable for AI drafts an admin is
// actively curating). Resets adminApproved/adminEdited — a regenerated
// lesson has new, unreviewed content.
router.post('/lessons/:id/regenerate', async (req: Request, res: Response) => {
  if (!isEnglishTutorConfigured()) {
    return res.status(501).json({ message: 'AI English Tutor is not configured yet (GEMINI_API_KEY).' });
  }
  const existing = await prisma.tutorLesson.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Lesson not found.' });

  try {
    const content = await generateTutorLesson({
      taskType: existing.taskType as TutorTaskType,
      level: existing.level as CefrLevel,
      nativeLang: existing.nativeLang,
      topic: existing.topic ?? undefined,
      extras: { learningGoal: existing.learningGoal ?? undefined },
    });
    const lesson = await prisma.tutorLesson.update({
      where: { id: req.params.id },
      data: { content: content as any, adminApproved: false, adminEdited: false, adminReviewedAt: null, adminReviewedById: null },
    });
    res.json({ data: lesson });
  } catch (err) {
    if (err instanceof EnglishTutorError) return res.status(502).json({ message: err.message });
    throw err;
  }
});

// ============================================================
// LIVE SESSION AUDIT LOGS & DIALOGUE MONITOR — transcripts + AI feedback,
// with a flag/resolve workflow for quality control.
// ============================================================
const listProgressQuery = z.object({
  userId: z.string().uuid().optional(),
  taskType: z.enum(TASK_TYPES).optional(),
  flagged: z.enum(['true']).optional(),
  page: z.coerce.number().int().min(1).default(1),
});
const PROGRESS_PAGE_SIZE = 25;

router.get('/audit-logs', async (req: Request, res: Response) => {
  const result = listProgressQuery.safeParse(req.query);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { userId, taskType, flagged, page } = result.data;

  const where = {
    ...(userId ? { userId } : {}),
    ...(taskType ? { tutorLesson: { taskType } } : {}),
    ...(flagged ? { flags: { some: { status: 'OPEN' as const } } } : {}),
  };

  const [progress, total] = await Promise.all([
    prisma.userTutorProgress.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * PROGRESS_PAGE_SIZE,
      take: PROGRESS_PAGE_SIZE,
      include: {
        user: { select: { id: true, name: true, email: true } },
        tutorLesson: { select: { id: true, taskType: true, level: true, topic: true, learningGoal: true } },
        flags: { where: { status: 'OPEN' }, select: { id: true, reason: true, createdAt: true } },
      },
    }),
    prisma.userTutorProgress.count({ where }),
  ]);
  res.json({ data: progress, meta: { total, page, pageSize: PROGRESS_PAGE_SIZE } });
});

router.get('/flags', async (req: Request, res: Response) => {
  const statusFilter = req.query.status === 'RESOLVED' || req.query.status === 'DISMISSED' ? req.query.status : 'OPEN';
  const flags = await prisma.tutorContentFlag.findMany({
    where: { status: statusFilter },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      flaggedByUser: { select: { id: true, name: true, email: true } },
      tutorLesson: { select: { id: true, taskType: true, level: true } },
      userTutorProgress: { select: { id: true, tutorLessonId: true } },
    },
  });
  res.json({ data: flags });
});

const resolveFlagSchema = z.object({ status: z.enum(['RESOLVED', 'DISMISSED']), adminNote: z.string().trim().max(1000).optional() });

router.post('/flags/:id/resolve', async (req: Request, res: Response) => {
  const result = resolveFlagSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const existing = await prisma.tutorContentFlag.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Flag not found.' });

  const flag = await prisma.tutorContentFlag.update({
    where: { id: req.params.id },
    data: {
      status: result.data.status,
      adminNote: result.data.adminNote ?? null,
      reviewedAt: new Date(),
      reviewedByAdminId: req.user!.id,
    },
  });
  res.json({ data: flag });
});

// ============================================================
// AGENT PROMPT & PARAMETER CONFIGURATOR
// ============================================================
router.get('/prompt-config', async (_req: Request, res: Response) => {
  const overrides = await prisma.tutorPromptOverride.findMany();
  const byTaskType = new Map(overrides.map((o) => [o.taskType, o]));
  const data = TASK_TYPES.map((taskType) => {
    const existing = byTaskType.get(taskType);
    return {
      taskType,
      systemPromptOverride: existing?.systemPromptOverride ?? null,
      temperatureOverride: existing?.temperatureOverride ?? null,
      updatedAt: existing?.updatedAt ?? null,
    };
  });
  res.json({ data });
});

const promptConfigSchema = z.object({
  systemPromptOverride: z.string().trim().max(4000).nullable(),
  temperatureOverride: z.number().min(0).max(2).nullable(),
});

router.put('/prompt-config/:taskType', async (req: Request, res: Response) => {
  const taskType = req.params.taskType as (typeof TASK_TYPES)[number];
  if (!TASK_TYPES.includes(taskType)) return res.status(400).json({ message: 'Invalid taskType.' });
  const result = promptConfigSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const override = await prisma.tutorPromptOverride.upsert({
    where: { taskType },
    create: {
      taskType,
      systemPromptOverride: result.data.systemPromptOverride,
      temperatureOverride: result.data.temperatureOverride,
      updatedByAdminId: req.user!.id,
    },
    update: {
      systemPromptOverride: result.data.systemPromptOverride,
      temperatureOverride: result.data.temperatureOverride,
      updatedByAdminId: req.user!.id,
    },
  });
  res.json({ data: override });
});

export default router;
