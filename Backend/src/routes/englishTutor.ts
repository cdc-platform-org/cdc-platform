import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireApproved } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import {
  isEnglishTutorConfigured,
  generateTutorLesson,
  sanitizeLessonContentForClient,
  gradeTutorSubmission,
  generateDialogueReply,
  generatePlacementTest,
  estimatePlacementLevel,
  isProLevel,
  EnglishTutorError,
  CefrLevel,
  TutorTaskType,
  TutorLearningGoal,
  DialogueContent,
  DialogueTurn,
  PlacementQuestion,
} from '../services/englishTutorService';
import { hasEnglishTutorProAccess } from '../utils/englishTutorAccess';
import {
  hasReachedDailyLessonGenerationLimit,
  recordLessonGeneration,
  getDailyLessonGenerationUsage,
  DAILY_FREE_LESSON_GENERATION_LIMIT,
} from '../services/englishTutorQuotaService';
import {
  startTutorTrial,
  TutorTrialAlreadyUsedError,
  cancelTutorSubscriptionAutoRenew,
  TUTOR_TRIAL_DAYS,
} from '../services/englishTutorSubscriptionService';

const router = Router();
router.use(authenticate, requireApproved);

const TASK_TYPES = ['READING', 'WRITING', 'GRAMMAR', 'VOCABULARY', 'QUIZ', 'LISTENING', 'DIALOGUE'] as const;
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
const LEARNING_GOALS = ['TRAVEL', 'TECHNICAL_IT', 'BUSINESS', 'ACADEMIC', 'GENERAL_DAILY', 'INTERVIEW_PREP'] as const;

// Same abuse-prevention shape as aiAgentsSuite.ts's /generate and ai.ts's
// courseTutorRateLimit — a real Gemini quota spend sits behind every
// generation, so this needs its own budget independent of the daily
// FREE-tier lesson cap (which limits how many lessons a FREE account may
// create per day; this limits how fast anyone can hammer the endpoint).
const generateRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: 'Too many requests. Please wait a moment before trying again.',
});
const dialogueReplyRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: 'Too many messages. Please wait a moment before sending more.',
});
const placementTestRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many placement test requests. Please wait a moment before trying again.',
});

async function loadAccessUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      tutorSubscriptionTier: true,
      tutorNativeLang: true,
      tutorLearningGoal: true,
      tutorTrialStartDate: true,
      tutorTrialEndDate: true,
      tutorSubscriptionAutoRenew: true,
      tutorSubscriptionPeriodEnd: true,
    },
  });
}

// Looks up an admin's per-taskType prompt/temperature override (see
// TutorPromptOverride's own schema comment) — englishTutorService.ts stays
// Prisma-free, so this DB read happens here and gets passed in as plain
// params.
async function loadGenerationExtras(taskType: TutorTaskType, learningGoal: TutorLearningGoal | null | undefined) {
  const override = await prisma.tutorPromptOverride.findUnique({ where: { taskType } });
  return {
    learningGoal: learningGoal ?? undefined,
    promptOverride: override?.systemPromptOverride ?? undefined,
    temperatureOverride: override?.temperatureOverride ?? undefined,
  };
}

// Lets the frontend show an accurate "X/3 today" badge, trial/subscription
// state, and the current tutorNativeLang/tutorLearningGoal defaults before
// the student has generated anything this session — same reasoning as
// ai.ts's GET .../usage endpoint.
router.get('/state', async (req: Request, res: Response) => {
  const user = await loadAccessUser(req.user!.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  const isPro = hasEnglishTutorProAccess({ role: user.role, tutorSubscriptionTier: user.tutorSubscriptionTier, tutorTrialEndDate: user.tutorTrialEndDate });
  const usage = await getDailyLessonGenerationUsage(req.user!.id, isPro);
  const trialActive = !!user.tutorTrialEndDate && user.tutorTrialEndDate.getTime() > Date.now();
  res.json({
    data: {
      isPro,
      tutorNativeLang: user.tutorNativeLang,
      tutorLearningGoal: user.tutorLearningGoal,
      dailyGenerationUsed: usage.used,
      dailyGenerationLimit: usage.limit,
      trialAvailable: !user.tutorTrialStartDate,
      trialActive,
      tutorTrialEndDate: user.tutorTrialEndDate,
      subscriptionTier: user.tutorSubscriptionTier,
      subscriptionAutoRenew: user.tutorSubscriptionAutoRenew,
      subscriptionPeriodEnd: user.tutorSubscriptionPeriodEnd,
    },
  });
});

// Cardless 5-day trial — POST-only, one-time (see startTutorTrial's own
// comment). No card/payment step at all.
router.post('/trial/start', async (req: Request, res: Response) => {
  try {
    const { tutorTrialEndDate } = await startTutorTrial(req.user!.id);
    res.status(201).json({ data: { tutorTrialEndDate, trialDays: TUTOR_TRIAL_DAYS } });
  } catch (err) {
    if (err instanceof TutorTrialAlreadyUsedError) return res.status(400).json({ message: err.message });
    throw err;
  }
});

// Turns off the pre-expiry renewal reminder — see
// cancelTutorSubscriptionAutoRenew's own comment for why this never itself
// revokes access; access simply runs out at tutorSubscriptionPeriodEnd
// either way.
router.post('/subscription/cancel', async (req: Request, res: Response) => {
  await cancelTutorSubscriptionAutoRenew(req.user!.id);
  res.json({ data: { subscriptionAutoRenew: false } });
});

const goalSchema = z.object({ learningGoal: z.enum(LEARNING_GOALS) });

router.put('/goal', async (req: Request, res: Response) => {
  const result = goalSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  await prisma.user.update({ where: { id: req.user!.id }, data: { tutorLearningGoal: result.data.learningGoal as TutorLearningGoal } });
  res.json({ data: { tutorLearningGoal: result.data.learningGoal } });
});

// ---- Granular resume state — one row per user, upserted on every
// task-runner step change / panel exit. ----
router.get('/resume-state', async (req: Request, res: Response) => {
  const state = await prisma.userTutorResumeState.findUnique({ where: { userId: req.user!.id } });
  res.json({ data: state });
});

const resumeStateSchema = z.object({
  lastLessonId: z.string().uuid().nullable().optional(),
  stepIndex: z.number().int().min(0).default(0),
  audioTimestampSec: z.number().min(0).nullable().optional(),
});

router.put('/resume-state', async (req: Request, res: Response) => {
  const result = resumeStateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { lastLessonId, stepIndex, audioTimestampSec } = result.data;
  const state = await prisma.userTutorResumeState.upsert({
    where: { userId: req.user!.id },
    create: { userId: req.user!.id, lastLessonId: lastLessonId ?? null, stepIndex, audioTimestampSec: audioTimestampSec ?? null },
    update: { lastLessonId: lastLessonId ?? null, stepIndex, audioTimestampSec: audioTimestampSec ?? null },
  });
  res.json({ data: state });
});

// ---- Placement test (onboarding step 3) ----
router.get('/placement-test', placementTestRateLimit, async (req: Request, res: Response) => {
  if (!isEnglishTutorConfigured()) {
    return res.status(501).json({ message: 'AI English Tutor is not configured yet (GEMINI_API_KEY).' });
  }
  const nativeLang = typeof req.query.nativeLang === 'string' ? req.query.nativeLang.trim() : '';
  if (!nativeLang) return res.status(400).json({ message: 'nativeLang is required.' });
  try {
    const questions = await generatePlacementTest(nativeLang);
    // Same answer-key-stripping posture as sanitizeLessonContentForClient
    // — the client only ever sees question/options/level, never
    // correctAnswer/explanation, until it submits.
    const sanitized = questions.map(({ question, options, level }) => ({ question, options, level }));
    res.json({ data: { questions: sanitized, raw: questions } });
  } catch (err) {
    if (err instanceof EnglishTutorError) return res.status(502).json({ message: err.message });
    throw err;
  }
});

// The full (un-sanitized, with correctAnswer) question set the client got
// from GET /placement-test's own `raw` field is echoed back here for
// grading — placement questions aren't persisted anywhere (unlike
// TutorLesson), so there is no server-side row to grade against the way
// /lessons/:id/submit does; this is a stateless one-shot test, and the
// client already legitimately saw `raw` in the same response, so nothing
// new is exposed by accepting it back.
const placementSubmitSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string(),
      options: z.object({ A: z.string(), B: z.string(), C: z.string(), D: z.string() }),
      correctAnswer: z.enum(['A', 'B', 'C', 'D']),
      explanation: z.string(),
      level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1']),
    })
  ),
  answers: z.record(z.string(), z.string()),
});

router.post('/placement-test/submit', async (req: Request, res: Response) => {
  const result = placementSubmitSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const level = estimatePlacementLevel(result.data.questions as PlacementQuestion[], result.data.answers);
  res.json({ data: { level } });
});

const generateSchema = z.object({
  taskType: z.enum(TASK_TYPES),
  level: z.enum(LEVELS),
  nativeLang: z.string().trim().min(2).max(20),
  topic: z.string().trim().min(1).max(200).optional(),
});

router.post('/lessons/generate', generateRateLimit, async (req: Request, res: Response) => {
  if (!isEnglishTutorConfigured()) {
    return res.status(501).json({ message: 'AI English Tutor is not configured yet (GEMINI_API_KEY).' });
  }

  const result = generateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { taskType, level, nativeLang, topic } = result.data;

  const user = await loadAccessUser(req.user!.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  const isPro = hasEnglishTutorProAccess({ role: user.role, tutorSubscriptionTier: user.tutorSubscriptionTier, tutorTrialEndDate: user.tutorTrialEndDate });

  // Server-side re-check regardless of what the frontend's level picker
  // already restricts — never trust the client for enforcement (same
  // posture as aiAgentsSuite.ts's /generate).
  if (isProLevel(level as CefrLevel) && !isPro) {
    return res.status(403).json({ message: 'This level is available on the Pro plan. Upgrade to unlock B2-C2 lessons.' });
  }
  if (await hasReachedDailyLessonGenerationLimit(req.user!.id, isPro)) {
    return res.status(403).json({ message: `You've reached today's free lesson limit (${DAILY_FREE_LESSON_GENERATION_LIMIT}). Upgrade to Pro for unlimited lessons, or come back tomorrow.` });
  }

  try {
    const extras = await loadGenerationExtras(taskType as TutorTaskType, user.tutorLearningGoal);
    const content = await generateTutorLesson({ taskType: taskType as TutorTaskType, level: level as CefrLevel, nativeLang, topic, extras });
    const lesson = await prisma.tutorLesson.create({
      data: {
        taskType: taskType as TutorTaskType,
        level: level as CefrLevel,
        nativeLang,
        topic: topic ?? null,
        learningGoal: user.tutorLearningGoal ?? null,
        content: content as any,
        isPro: isProLevel(level as CefrLevel),
        generatedForUserId: req.user!.id,
      },
    });
    await recordLessonGeneration(req.user!.id);
    // Remembers the student's chosen native language for next time — see
    // User.tutorNativeLang's own comment. Fire-and-forget: never block the
    // response on this convenience write.
    if (user.tutorNativeLang !== nativeLang) {
      prisma.user.update({ where: { id: req.user!.id }, data: { tutorNativeLang: nativeLang } }).catch(() => {});
    }

    res.status(201).json({
      data: {
        id: lesson.id,
        taskType: lesson.taskType,
        level: lesson.level,
        nativeLang: lesson.nativeLang,
        topic: lesson.topic,
        learningGoal: lesson.learningGoal,
        isPro: lesson.isPro,
        createdAt: lesson.createdAt,
        content: sanitizeLessonContentForClient(lesson.taskType as TutorTaskType, lesson.content),
      },
    });
  } catch (err) {
    if (err instanceof EnglishTutorError) return res.status(502).json({ message: err.message });
    throw err;
  }
});

// A student's own past lessons — most recent first, for a simple history
// list on the dashboard. Not paginated in this phase (mirrors several
// other "list my own X" endpoints in this codebase, e.g.
// getMyHRSupportRequests) — safe at this feature's expected volume.
router.get('/lessons', async (req: Request, res: Response) => {
  const lessons = await prisma.tutorLesson.findMany({
    where: { generatedForUserId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      taskType: true,
      level: true,
      nativeLang: true,
      topic: true,
      learningGoal: true,
      isPro: true,
      createdAt: true,
      progress: { select: { id: true, status: true, score: true, completedAt: true }, orderBy: { startedAt: 'desc' }, take: 1 },
    },
  });
  res.json({ data: lessons });
});

async function loadOwnedLesson(id: string, userId: string) {
  const lesson = await prisma.tutorLesson.findUnique({ where: { id } });
  if (!lesson || lesson.generatedForUserId !== userId) return null;
  return lesson;
}

router.get('/lessons/:id', async (req: Request, res: Response) => {
  const lesson = await loadOwnedLesson(req.params.id, req.user!.id);
  if (!lesson) return res.status(404).json({ message: 'Lesson not found.' });
  res.json({
    data: {
      id: lesson.id,
      taskType: lesson.taskType,
      level: lesson.level,
      nativeLang: lesson.nativeLang,
      topic: lesson.topic,
      learningGoal: lesson.learningGoal,
      isPro: lesson.isPro,
      createdAt: lesson.createdAt,
      content: sanitizeLessonContentForClient(lesson.taskType as TutorTaskType, lesson.content),
    },
  });
});

const submitSchema = z.object({ responseData: z.unknown() });

// Grades against the lesson's real (un-sanitized) content read straight
// from the DB — the client only ever sees the sanitized version, so there
// is nothing for it to tamper with the answer key of.
router.post('/lessons/:id/submit', async (req: Request, res: Response) => {
  const lesson = await loadOwnedLesson(req.params.id, req.user!.id);
  if (!lesson) return res.status(404).json({ message: 'Lesson not found.' });

  const result = submitSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  try {
    const grading = await gradeTutorSubmission(
      lesson.taskType as TutorTaskType,
      lesson.level as CefrLevel,
      lesson.nativeLang,
      lesson.content,
      result.data.responseData
    );
    const progress = await prisma.userTutorProgress.create({
      data: {
        userId: req.user!.id,
        tutorLessonId: lesson.id,
        status: 'COMPLETED',
        score: grading.score,
        responseData: result.data.responseData as any,
        feedback: grading.feedback as any,
        completedAt: new Date(),
      },
    });
    res.status(201).json({ data: progress });
  } catch (err) {
    if (err instanceof EnglishTutorError) return res.status(502).json({ message: err.message });
    throw err;
  }
});

// A student's own progress history, most recent first.
router.get('/progress', async (req: Request, res: Response) => {
  const progress = await prisma.userTutorProgress.findMany({
    where: { userId: req.user!.id },
    orderBy: { startedAt: 'desc' },
    take: 50,
    include: { tutorLesson: { select: { taskType: true, level: true, topic: true } } },
  });
  res.json({ data: progress });
});

// ---- Content flagging — "catch hallucinations or inaccurate feedback"
// (RFC's admin governance ask). Exactly one of lessonId/progressId is
// accepted per request (matching TutorContentFlag's own XOR posture); both
// must be owned by the caller. ----
const flagSchema = z
  .object({
    lessonId: z.string().uuid().optional(),
    progressId: z.string().uuid().optional(),
    reason: z.string().trim().min(5).max(1000),
  })
  .refine((v) => !!v.lessonId !== !!v.progressId, { message: 'Provide exactly one of lessonId or progressId.' });

router.post('/flags', async (req: Request, res: Response) => {
  const result = flagSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { lessonId, progressId, reason } = result.data;

  if (lessonId) {
    const lesson = await loadOwnedLesson(lessonId, req.user!.id);
    if (!lesson) return res.status(404).json({ message: 'Lesson not found.' });
  } else if (progressId) {
    const progress = await prisma.userTutorProgress.findUnique({ where: { id: progressId } });
    if (!progress || progress.userId !== req.user!.id) return res.status(404).json({ message: 'Progress record not found.' });
  }

  const flag = await prisma.tutorContentFlag.create({
    data: {
      tutorLessonId: lessonId ?? null,
      userTutorProgressId: progressId ?? null,
      flaggedByUserId: req.user!.id,
      reason,
    },
  });
  res.status(201).json({ data: flag });
});

// ---- Live roleplay turns (DIALOGUE lessons only) ----
const dialogueTurnSchema = z.object({ role: z.enum(['student', 'tutor']), text: z.string().min(1).max(2000) });
const dialogueMessageSchema = z.object({
  history: z.array(dialogueTurnSchema).max(40),
  message: z.string().trim().min(1).max(2000),
});

router.post('/lessons/:id/dialogue-message', dialogueReplyRateLimit, async (req: Request, res: Response) => {
  if (!isEnglishTutorConfigured()) {
    return res.status(501).json({ message: 'AI English Tutor is not configured yet (GEMINI_API_KEY).' });
  }
  const lesson = await loadOwnedLesson(req.params.id, req.user!.id);
  if (!lesson) return res.status(404).json({ message: 'Lesson not found.' });
  if (lesson.taskType !== 'DIALOGUE') return res.status(400).json({ message: 'This lesson is not a Dialogue/Roleplay lesson.' });

  const result = dialogueMessageSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  try {
    const reply = await generateDialogueReply(
      lesson.content as unknown as DialogueContent,
      lesson.level as CefrLevel,
      lesson.nativeLang,
      result.data.history as DialogueTurn[],
      result.data.message
    );
    res.json({ data: { reply } });
  } catch (err) {
    if (err instanceof EnglishTutorError) return res.status(502).json({ message: err.message });
    throw err;
  }
});

export default router;
