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
import {
  FIRST_STAGE_ID,
  getStage,
  getVocabItem,
  translateFor,
  applyLearnerName,
  isWriteAnswerCorrect,
  BeginnerBlock,
} from '../services/beginnerCurriculumService';

const router = Router();
router.use(authenticate, requireApproved);

const TASK_TYPES = ['READING', 'WRITING', 'GRAMMAR', 'VOCABULARY', 'QUIZ', 'LISTENING', 'DIALOGUE'] as const;
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
const LEARNING_GOALS = ['TRAVEL', 'TECHNICAL_IT', 'BUSINESS', 'ACADEMIC', 'GENERAL_DAILY', 'INTERVIEW_PREP'] as const;

// Platform-wide product policy (2026-10): Russian is not offered anywhere
// on CDC as a selectable language, including here as an IMIAKO
// explanation/support language. nativeLang is otherwise genuinely
// free-text (any ISO code or language name a learner types — see
// englishTutorService.nativeLanguageLine's own comment), by original
// design, so this can't be a fixed enum without breaking that flexibility
// for every OTHER language; it specifically targets Russian instead of
// restricting the field as a whole. Applied at every nativeLang-accepting
// entry point in this router (never relying on the frontend alone having
// removed it from its pickers — see data/tutorSupportLanguages.ts) so a
// request submitted directly to the API can't bypass the UI change.
// Falls back to English per this task's own stated preference, rather than
// rejecting the request outright — consistent with how an uncurated (but
// otherwise legitimate) nativeLang already degrades gracefully elsewhere
// (beginnerCurriculumService.translateFor's own English-fallback posture).
const RUSSIAN_LANGUAGE_PATTERN = /^ru(-ru)?$|russian|русск/i;
export function sanitizeNativeLang(nativeLang: string): string {
  return RUSSIAN_LANGUAGE_PATTERN.test(nativeLang.trim()) ? 'en' : nativeLang;
}

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
  const rawNativeLang = typeof req.query.nativeLang === 'string' ? req.query.nativeLang.trim() : '';
  if (!rawNativeLang) return res.status(400).json({ message: 'nativeLang is required.' });
  const nativeLang = sanitizeNativeLang(rawNativeLang);
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
  const { taskType, level, topic } = result.data;
  const nativeLang = sanitizeNativeLang(result.data.nativeLang);

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

// ============================================================
// BEGINNER PATH — deterministic, curated A0/A1-start curriculum (see
// beginnerCurriculumService.ts's own header comment for why this is fixed
// content rather than another AI-generation call). Three endpoints only:
// read the current state, advance past the current block (the server
// alone decides whether a WRITE answer was correct and whether to move
// on — see isWriteAnswerCorrect), and skip out into the normal
// lesson-generation flow. No AI call, no rate limiter needed (same
// zero-cost posture as PUT /goal and PUT /resume-state above).
// ============================================================

// Resolves one curriculum block into exactly what the client needs to
// render it — localized text, the learner's name already substituted into
// any {name} template, and crucially NO answer key for WRITE blocks (the
// client submits its guess to POST /advance and the server alone judges
// it, same "never expose the answer key to the grader's own client"
// posture as sanitizeLessonContentForClient above).
function serializeBeginnerBlock(block: BeginnerBlock, nativeLang: string, learnerDisplayName: string | null) {
  const name = learnerDisplayName ?? '';
  switch (block.type) {
    case 'GREETING':
      return { id: block.id, type: block.type, textEn: block.textEn };
    case 'WORD': {
      const vocab = getVocabItem(block.vocabId);
      if (!vocab) return null;
      return {
        id: block.id,
        type: block.type,
        word: { word: vocab.word, ipa: vocab.ipa, exampleSentenceEn: vocab.exampleSentenceEn, translation: translateFor(block.vocabId, vocab.word, nativeLang) },
      };
    }
    case 'SENTENCE':
      return { id: block.id, type: block.type, textEn: block.textEn };
    case 'GRAMMAR_TIP':
      return {
        id: block.id,
        type: block.type,
        titleEn: block.titleEn,
        translation: translateFor(block.translationKey, block.titleEn, nativeLang),
        examplesEn: block.examplesEn.map((e) => applyLearnerName(e, name)),
      };
    case 'QUESTION_NAME':
      return { id: block.id, type: block.type, textEn: block.promptEn, translation: translateFor(block.translationKey, block.promptEn, nativeLang) };
    case 'PERSONAL_SENTENCE':
      return { id: block.id, type: block.type, textEn: applyLearnerName(block.templateEn, name) };
    case 'WRITE':
      return {
        id: block.id,
        type: block.type,
        textEn: block.instructionEn,
        translation: translateFor(block.translationKey, block.instructionEn, nativeLang),
        audioTextEn: block.audioTextEn, // never expectedTemplateEn — that stays server-only
      };
    case 'MINI_DIALOGUE':
      return { id: block.id, type: block.type, turns: block.turns.map((t) => ({ speaker: t.speaker, textEn: applyLearnerName(t.textEn, name) })) };
    case 'CHECKPOINT':
      return { id: block.id, type: block.type, textEn: block.titleEn, translation: translateFor(block.translationKey, block.titleEn, nativeLang) };
  }
}

async function loadOrLazilyCreateBeginnerProgress(userId: string, tutorNativeLangAlreadySet: boolean) {
  const existing = await prisma.userTutorBeginnerProgress.findUnique({ where: { userId } });
  if (existing) return existing;
  // tutorNativeLang is only ever set as a side effect of the student's
  // FIRST real AI-generated lesson (see POST /lessons/generate above) — its
  // presence here means this account predates the Beginner Path and must
  // never be retroactively dropped into it (preserve existing users'
  // experience exactly as it was).
  if (tutorNativeLangAlreadySet) return null;
  return prisma.userTutorBeginnerProgress.create({ data: { userId, currentStageId: FIRST_STAGE_ID } });
}

function serializeBeginnerState(
  progress: { learnerDisplayName: string | null; currentStageId: string; currentBlockIndex: number; completedAt: Date | null; skippedAt: Date | null } | null,
  nativeLang: string
) {
  if (!progress) return { active: false as const };
  if (progress.completedAt || progress.skippedAt) return { active: false as const, completedAt: progress.completedAt, skippedAt: progress.skippedAt };

  const stage = getStage(progress.currentStageId);
  if (!stage) return { active: false as const }; // unknown stage id (shouldn't happen) — fail safe into normal flow
  const block = stage.blocks[progress.currentBlockIndex];
  if (!block) return { active: false as const };

  return {
    active: true as const,
    stageId: stage.id,
    blockIndex: progress.currentBlockIndex,
    totalBlocksInStage: stage.blocks.length,
    // Lets the client distinguish "this checkpoint leads to another stage"
    // from "this is the last curated stage — finishing it hands the
    // learner off to the normal lesson-generation flow" (different button
    // copy: "Next stage" vs "Start practicing").
    isLastStage: stage.nextStageId === null,
    learnerDisplayName: progress.learnerDisplayName,
    block: serializeBeginnerBlock(block, nativeLang, progress.learnerDisplayName),
  };
}

router.get('/beginner-path/state', async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { tutorNativeLang: true } });
  if (!user) return res.status(404).json({ message: 'User not found.' });

  const queryNativeLang = sanitizeNativeLang(typeof req.query.nativeLang === 'string' ? req.query.nativeLang.trim() : '');
  // An explicit choice on THIS request always wins — the learner may be
  // actively changing their support language right now (see the Beginner
  // Path's settings control), and a stale persisted value must never
  // override that (this was a real bug: `tutorNativeLang || queryNativeLang`
  // meant that once ANY language was ever persisted, no later query param
  // could ever change it again — the exact "locked to ka" symptom reported).
  // Also sanitized even when it falls back to the STORED value — covers a
  // hypothetical pre-policy row that already has tutorNativeLang="ru" from
  // before Russian was removed (never deleted/migrated, see section 5 of
  // the removal task; this is the runtime-fallback half of that promise).
  const nativeLang = sanitizeNativeLang(queryNativeLang || user.tutorNativeLang || 'en');
  // Same fire-and-forget "remember it for next time" posture as POST
  // /lessons/generate — only a convenience write, never blocks the response.
  if (queryNativeLang && user.tutorNativeLang !== queryNativeLang) {
    prisma.user.update({ where: { id: req.user!.id }, data: { tutorNativeLang: queryNativeLang } }).catch(() => {});
  }

  // "Already a pre-existing user" is purely about whether tutorNativeLang
  // was set in the DB BEFORE this request — independent of whatever
  // nativeLang this particular call happens to pass (an existing user
  // changing their support language must never be treated as a brand-new
  // signup and silently re-enrolled into Beginner Path progress).
  const progress = await loadOrLazilyCreateBeginnerProgress(req.user!.id, !!user.tutorNativeLang);
  res.json({ data: serializeBeginnerState(progress, nativeLang) });
});

const advanceSchema = z.object({
  blockId: z.string().min(1),
  responseText: z.string().trim().max(200).optional(),
  displayName: z.string().trim().min(1).max(40).optional(),
  nativeLang: z.string().trim().min(2).max(20).optional(),
});

router.post('/beginner-path/advance', async (req: Request, res: Response) => {
  const result = advanceSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { blockId, responseText, displayName } = result.data;

  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { tutorNativeLang: true } });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  // Same "explicit choice on this request wins" precedence as GET
  // /beginner-path/state above — see that route's own comment.
  const nativeLang = sanitizeNativeLang(result.data.nativeLang || user.tutorNativeLang || 'en');

  const progress = await prisma.userTutorBeginnerProgress.findUnique({ where: { userId: req.user!.id } });
  if (!progress || progress.completedAt || progress.skippedAt) {
    return res.json({ data: serializeBeginnerState(progress, nativeLang) });
  }

  const stage = getStage(progress.currentStageId);
  const block = stage?.blocks[progress.currentBlockIndex];
  // The client can only ever advance the exact block the server last showed
  // it — a stale/replayed request naming an old blockId is a safe no-op
  // (returns the current, unchanged state) rather than skipping ahead.
  if (!stage || !block || block.id !== blockId) {
    return res.json({ data: serializeBeginnerState(progress, nativeLang) });
  }

  if (block.type === 'WRITE') {
    if (!responseText) return res.status(400).json({ errors: [{ message: 'responseText is required for this block.' }] });
    const correct = isWriteAnswerCorrect(block.expectedTemplateEn, progress.learnerDisplayName, responseText);
    if (!correct) {
      return res.json({ data: { ...serializeBeginnerState(progress, nativeLang), correct: false } });
    }
  }
  if (block.type === 'QUESTION_NAME') {
    if (!displayName) return res.status(400).json({ errors: [{ message: 'displayName is required for this block.' }] });
  }

  const nextIndexRaw = progress.currentBlockIndex + 1;
  const masteredConceptIds = progress.masteredConceptIds.includes(block.id) ? progress.masteredConceptIds : [...progress.masteredConceptIds, block.id];
  const progression =
    nextIndexRaw < stage.blocks.length
      ? { currentBlockIndex: nextIndexRaw }
      : stage.nextStageId
      ? { currentStageId: stage.nextStageId, currentBlockIndex: 0 }
      : { completedAt: new Date() };

  const updated = await prisma.userTutorBeginnerProgress.update({
    where: { userId: req.user!.id },
    data: {
      masteredConceptIds,
      ...(block.type === 'QUESTION_NAME' && displayName ? { learnerDisplayName: displayName } : {}),
      ...progression,
    },
  });
  res.json({ data: { ...serializeBeginnerState(updated, nativeLang), correct: true } });
});

router.post('/beginner-path/skip', async (req: Request, res: Response) => {
  const updated = await prisma.userTutorBeginnerProgress.upsert({
    where: { userId: req.user!.id },
    create: { userId: req.user!.id, skippedAt: new Date() },
    update: { skippedAt: new Date() },
  });
  res.json({ data: serializeBeginnerState(updated, 'en') });
});

export default router;
