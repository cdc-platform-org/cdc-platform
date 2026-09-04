import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireApproved } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { multerErrorHandler } from '../middleware/productUploads';
import {
  createExamSessionSchema,
  updateExamSessionSchema,
  startExamAttemptSchema,
  submitExamAttemptSchema,
  proctoringEventSchema,
} from '../schemas/examProctoringSchemas';
import {
  generateExamQuestions,
  gradePracticalAnswer,
  estimateAiTextScore,
  generateAdaptiveStudyGuide,
  extractExamSourceFromImage,
  ExamProctoringAiError,
  isExamProctoringConfigured,
} from '../services/examProctoringService';
import { parseDocumentToMarkdown, DocumentParseError } from '../services/documentParserService';
import {
  isMediaStudioUploadConfigured,
  isMediaStudioYoutubeConfigured,
  isValidYoutubeUrl,
  transcribeFromUpload,
  transcribeFromYoutube,
  MediaStudioError,
} from '../services/mediaStudioService';
import { recordExamGradingUsage } from '../services/billingService';
import { generateExamReportPdf } from '../services/examReportService';

const router = Router();

// A candidate never has (or needs) a CDC account — this strike limit stops
// one visitor from hammering the free-text grading endpoint, same posture
// as chatApi.ts's public widget rate limit.
const candidateRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'Too many requests. Please try again shortly.',
});

// Separate, much looser budget for proctoring event logging — this fires
// once per real tab-switch/paste over the whole exam duration, so it would
// blow through candidateRateLimit's 20-per-10-min budget (and lock a
// legitimate candidate out of their own submit call) well before hitting
// PROCTORING_FLAG_THRESHOLD violations.
const proctoringEventRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 200,
  message: 'Too many events reported. Please try again shortly.',
});

// Grace window added on top of ExamSession.durationMinutes before a
// late submission is treated as a timeout — covers real network/render
// latency between the candidate's client-side timer hitting zero and this
// request actually arriving, not an invitation to keep working past time.
const SUBMIT_GRACE_MS = 2 * 60 * 1000;

// Violations at or above this count force-submits the attempt as FLAGGED —
// same "disqualified" concept as freelancerExam.ts's strike limit, just
// named for what a business reviewing candidate reports needs to see.
const PROCTORING_FLAG_THRESHOLD = 5;
// Below this score (MCQ correctness or AI-graded PRACTICAL/CODE score), a
// question counts toward AdaptiveStudyGuide.weakTopics.
const PASS_MARK = 70;
// Integrity penalty per proctoring violation (tab-switch, copy/paste, ...),
// floored at 0 — a simple single number for the business's at-a-glance view.
const INTEGRITY_PENALTY_PER_VIOLATION = 8;

const questionForCandidate = { id: true, order: true, type: true, question: true, options: true } as const;

// ============================================================
// PUBLIC — CANDIDATE-FACING (no CDC account, addressed by opaque tokens)
// ============================================================

router.get('/candidate/:candidateToken', candidateRateLimit, async (req: Request, res: Response) => {
  const session = await prisma.examSession.findUnique({ where: { candidateToken: req.params.candidateToken } });
  if (!session || session.status !== 'ACTIVE') {
    return res.status(404).json({ message: 'This exam link is no longer active.' });
  }
  res.json({
    data: { title: session.title, description: session.description, durationMinutes: session.durationMinutes },
  });
});

router.post('/candidate/:candidateToken/start', candidateRateLimit, async (req: Request, res: Response) => {
  const session = await prisma.examSession.findUnique({ where: { candidateToken: req.params.candidateToken } });
  if (!session || session.status !== 'ACTIVE') {
    return res.status(404).json({ message: 'This exam link is no longer active.' });
  }
  const result = startExamAttemptSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const submission = await prisma.examSubmission.create({
    data: {
      examSessionId: session.id,
      candidateName: result.data.candidateName,
      candidateEmail: result.data.candidateEmail,
    },
  });
  const questions = await prisma.examQuestion.findMany({
    where: { examSessionId: session.id },
    select: questionForCandidate,
    orderBy: { order: 'asc' },
  });

  res.status(201).json({
    data: {
      submissionToken: submission.candidateToken,
      durationMinutes: session.durationMinutes,
      questions,
    },
  });
});

// Fired by the candidate's browser the moment a real violation happens
// (visibilitychange, blur, fullscreen-exit, paste — see Frontend's
// pages/exam/[token].tsx registerStrike) so the count lives server-side,
// timestamped by server receipt, from the start rather than being totalled
// up client-side and reported once at /submit — see that route's comment
// for why that mattered.
router.post('/submissions/:submissionToken/events', proctoringEventRateLimit, async (req: Request, res: Response) => {
  const submission = await prisma.examSubmission.findUnique({ where: { candidateToken: req.params.submissionToken } });
  if (!submission) return res.status(404).json({ message: 'Exam attempt not found.' });
  if (submission.status !== 'IN_PROGRESS') {
    // Attempt is already over — silently accept rather than error, since
    // this can legitimately race the final /submit call (e.g. a paste
    // event firing right as the timer auto-submits) and the event no
    // longer affects a score that's already been computed.
    return res.status(204).send();
  }

  const result = proctoringEventSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  await prisma.proctoringEvent.create({
    data: { submissionId: submission.id, type: result.data.type },
  });
  res.status(204).send();
});

router.post('/submissions/:submissionToken/submit', candidateRateLimit, async (req: Request, res: Response) => {
  const submission = await prisma.examSubmission.findUnique({ where: { candidateToken: req.params.submissionToken } });
  if (!submission) return res.status(404).json({ message: 'Exam attempt not found.' });
  if (submission.status !== 'IN_PROGRESS') {
    return res.status(400).json({ message: 'This exam attempt was already submitted.' });
  }

  const result = submitExamAttemptSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const session = await prisma.examSession.findUnique({ where: { id: submission.examSessionId } });
  if (!session) return res.status(404).json({ message: 'Exam session not found.' });

  const questions = await prisma.examQuestion.findMany({
    where: { examSessionId: session.id },
    orderBy: { order: 'asc' },
  });
  const mcqQuestions = questions.filter((q) => q.type === 'MCQ');
  const openQuestions = questions.filter((q) => q.type === 'PRACTICAL' || q.type === 'CODE');
  const answers = result.data.answers;

  const mcqCorrectCount = mcqQuestions.filter((q) => answers[q.id] === q.correctAnswer).length;
  const mcqScore = mcqQuestions.length > 0 ? Math.round((mcqCorrectCount / mcqQuestions.length) * 100) : null;

  // Server-authoritative violation counts — grouped from this submission's
  // ProctoringEvent rows (each written in real time by POST .../events as
  // the candidate's browser reported it), not from anything in this
  // request's body. A candidate calling this endpoint directly can no
  // longer just claim zero violations.
  const eventCounts = await prisma.proctoringEvent.groupBy({
    by: ['type'],
    where: { submissionId: submission.id },
    _count: { _all: true },
  });
  const countOf = (type: string) => eventCounts.find((e) => e.type === type)?._count._all ?? 0;
  // Fullscreen-exit is reported as the same "left the exam context" kind of
  // violation as a tab-switch (see Frontend's registerStrike('tab')) — both
  // roll into this one bucket.
  const tabSwitches = countOf('TAB_SWITCH') + countOf('FULLSCREEN_EXIT');
  const copyPasteCount = countOf('COPY_PASTE');
  const cameraAudioViolations = countOf('FACE_MISSING') + countOf('MULTIPLE_FACES') + countOf('LOOKING_AWAY') + countOf('BACKGROUND_VOICE');
  const proctoringViolations = tabSwitches + copyPasteCount + cameraAudioViolations;
  // Server-side timer enforcement — startedAt/durationMinutes, not anything
  // client-supplied, so stopping the browser's JS countdown (or simply
  // taking hours to call this endpoint) can no longer buy unlimited extra
  // time. Routed into the same FLAGGED/disqualified path as a proctoring
  // violation, for manual business review, rather than a hard rejection —
  // an attempt made under a real network hiccup still gets recorded instead
  // of losing the candidate's answers outright.
  const deadline = submission.startedAt.getTime() + session.durationMinutes * 60_000 + SUBMIT_GRACE_MS;
  const timedOut = Date.now() > deadline;
  const disqualified = proctoringViolations >= PROCTORING_FLAG_THRESHOLD || timedOut;
  const integrityScore = Math.max(0, 100 - proctoringViolations * INTEGRITY_PENALTY_PER_VIOLATION);

  // Atomically claim this submission for grading/completion before doing
  // any AI work — a concurrent submit call (double-click, client retry, or
  // a scripted replay) racing this one can no longer both pass the
  // `status !== 'IN_PROGRESS'` check above before either writes: only one
  // of them will match `status: 'IN_PROGRESS'` here and actually flip it,
  // so the loser aborts immediately (before spending any billed AI grading
  // calls) instead of both grading independently and the last write
  // silently overwriting the other's score.
  const claim = await prisma.examSubmission.updateMany({
    where: { id: submission.id, status: 'IN_PROGRESS' },
    data: {
      answers,
      mcqScore,
      proctoringViolations,
      tabSwitches,
      copyPasteCount,
      cameraAudioViolations,
      integrityScore,
      status: disqualified ? 'FLAGGED' : 'COMPLETED',
      completedAt: new Date(),
    },
  });
  if (claim.count === 0) {
    return res.status(400).json({ message: 'This exam attempt was already submitted.' });
  }

  // Per-question grading detail — the basis for both totalScore and
  // AdaptiveStudyGuide.weakTopics (see that model's own schema comment on
  // why this is a JSON blob rather than a child table).
  interface AnswerGrade {
    questionId: string;
    questionType: string;
    question: string;
    candidateAnswer: string;
    aiScore: number | null;
    aiFeedback: string | null;
    aiTextScore: number | null;
    correct?: boolean;
  }
  const answerGrades: AnswerGrade[] = mcqQuestions.map((q) => ({
    questionId: q.id,
    questionType: q.type,
    question: q.question,
    candidateAnswer: answers[q.id] ?? '',
    aiScore: null,
    aiFeedback: null,
    aiTextScore: null,
    correct: answers[q.id] === q.correctAnswer,
  }));

  const aiTextScores: number[] = [];

  // A disqualified (proctoring-flagged) attempt is never graded by AI — the
  // business reviews it manually instead, and this also avoids spending a
  // billed grading call on an attempt that's already being thrown out.
  if (!disqualified) {
    for (const q of openQuestions) {
      const answerText = answers[q.id] ?? '';
      try {
        const grade = await gradePracticalAnswer({
          topic: session.topic,
          questionType: q.type as 'PRACTICAL' | 'CODE',
          question: q.question,
          rubric: q.correctAnswer ?? '',
          answer: answerText,
          examEndTime: new Date(deadline),
        });
        let questionAiTextScore: number | null = null;
        if (answerText.trim().length >= 40) {
          try {
            const detection = await estimateAiTextScore(answerText);
            questionAiTextScore = detection.score;
            aiTextScores.push(detection.score);
            if (detection.usage) {
              recordExamGradingUsage({
                businessId: session.businessId,
                examSessionId: session.id,
                examSubmissionId: submission.id,
                promptTokens: detection.usage.promptTokens,
                completionTokens: detection.usage.completionTokens,
              }).catch((err) => console.error('[examProctoring] recordExamGradingUsage (ai-text) failed:', err));
            }
          } catch (err) {
            console.error('[examProctoring] estimateAiTextScore failed:', err);
          }
        }
        answerGrades.push({
          questionId: q.id,
          questionType: q.type,
          question: q.question,
          candidateAnswer: answerText,
          aiScore: grade.score,
          aiFeedback: grade.feedback,
          aiTextScore: questionAiTextScore,
        });
        if (grade.usage) {
          recordExamGradingUsage({
            businessId: session.businessId,
            examSessionId: session.id,
            examSubmissionId: submission.id,
            promptTokens: grade.usage.promptTokens,
            completionTokens: grade.usage.completionTokens,
          }).catch((err) => console.error('[examProctoring] recordExamGradingUsage failed:', err));
        }
      } catch (err) {
        // Grading failure never blocks the candidate's submission from being
        // recorded — the business sees a null score for this question and
        // can follow up manually, same "never lose the submission" posture
        // as the rest of this codebase's AI-dependent flows.
        console.error('[examProctoring] gradePracticalAnswer failed:', err);
        answerGrades.push({
          questionId: q.id,
          questionType: q.type,
          question: q.question,
          candidateAnswer: answerText,
          aiScore: null,
          aiFeedback: null,
          aiTextScore: null,
        });
      }
    }
  }

  const openScores = answerGrades.filter((g) => g.aiScore != null).map((g) => g.aiScore as number);
  const practicalScore = openScores.length > 0 ? Math.round(openScores.reduce((a, b) => a + b, 0) / openScores.length) : null;
  const aiTextScore = aiTextScores.length > 0 ? Math.round(aiTextScores.reduce((a, b) => a + b, 0) / aiTextScores.length) : null;

  const scores = [mcqScore, practicalScore].filter((s): s is number => s != null);
  const totalScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  // Plain update, not another atomic claim — this submission was already
  // exclusively claimed above (status flipped out of IN_PROGRESS), so no
  // concurrent submit call can still be racing us here.
  await prisma.examSubmission.update({
    where: { id: submission.id },
    data: {
      practicalScore,
      totalScore,
      aiEvaluation: answerGrades.find((g) => g.aiFeedback)?.aiFeedback ?? null,
      answerGrades: answerGrades as unknown as Prisma.InputJsonValue,
      aiTextScore,
    },
  });

  // Auto-generate an adaptive study guide when the candidate scored below
  // PASS_MARK on any question — see AdaptiveStudyGuide's own comment. Never
  // blocks the submission response; failures are logged and simply mean no
  // guide exists yet (the business can still see the weak questions
  // themselves in the report).
  const weakQuestions = answerGrades.filter((g) => (g.correct === false || (g.aiScore != null && g.aiScore < PASS_MARK)));
  if (!disqualified && weakQuestions.length > 0) {
    generateAdaptiveStudyGuide({ topic: session.topic, weakTopics: weakQuestions.map((q) => q.question) })
      .then(async (guide) => {
        await prisma.adaptiveStudyGuide.create({
          data: {
            examSubmissionId: submission.id,
            candidateEmail: submission.candidateEmail,
            weakTopics: weakQuestions.map((q) => q.question),
            generatedGuideText: guide.guideText,
          },
        });
        if (guide.usage) {
          recordExamGradingUsage({
            businessId: session.businessId,
            examSessionId: session.id,
            examSubmissionId: submission.id,
            promptTokens: guide.usage.promptTokens,
            completionTokens: guide.usage.completionTokens,
          }).catch((err) => console.error('[examProctoring] recordExamGradingUsage (study-guide) failed:', err));
        }
      })
      .catch((err) => console.error('[examProctoring] generateAdaptiveStudyGuide failed:', err));
  }

  // Deliberately no score in the response — this is a screening tool for
  // the business, not a self-assessment result for the candidate (unlike
  // freelancerExam.ts, where the taker IS the one being credentialed).
  res.json({ data: { submitted: true } });
});

// ============================================================
// BUSINESS — exam session management + candidate reports
// ============================================================

// Open to every approved account, not just Business (Client) — see
// graduateStatusService/forum.ts's own comment: the Employment Forum is the
// only platform feature gated by tier. Every session below is still scoped
// to its own creator via loadOwnedSession's businessId check, not a role
// gate.
router.use(authenticate, requireApproved);

// Parses an optional PDF/DOCX exam-source upload (job description, existing
// test bank, etc.) into plain text — returned to the client, then passed
// back as `rawContent` on POST /sessions. Same two-step upload-then-submit
// shape as Agent's knowledge-file upload, and reuses the identical parser.
const sourceUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedExt = /\.(pdf|docx|md|txt)$/i;
    if (allowedExt.test(file.originalname)) cb(null, true);
    else cb(new Error('Only PDF, DOCX, or Markdown (.md) files are allowed.'));
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.post(
  '/sessions/parse-source',
  (req: Request, res: Response, next) => {
    sourceUpload.single('file')(req, res, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'File exceeds the 20MB limit.' });
      }
      return res.status(400).json({ message: err.message || 'Only PDF, DOCX, or Markdown (.md) files are allowed.' });
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No file was selected.' });
    try {
      const markdown = await parseDocumentToMarkdown(req.file.buffer, req.file.mimetype, req.file.originalname);
      res.status(201).json({ data: { rawContent: markdown } });
    } catch (err) {
      const message = err instanceof DocumentParseError ? err.message : 'Failed to parse this document.';
      res.status(400).json({ message });
    }
  }
);

// Video/YouTube source material — reuses Media Studio's own
// transcription pipeline (Backend/src/services/mediaStudioService.ts)
// rather than reimplementing ffmpeg extraction + Gemini File API upload;
// the resulting transcript flows into `rawContent` exactly like a parsed
// PDF/DOCX. Same "file OR youtubeUrl on one endpoint" shape as
// routes/mediaStudio.ts's own /transcribe — multer only engages for an
// actual multipart request, so a plain JSON {youtubeUrl} body passes
// through untouched.
const videoSourceUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (/^(video|audio)\//.test(file.mimetype) || /\.(mp4|mov|webm|mp3|wav|m4a)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Only MP4, MOV, WEBM, MP3, WAV, or M4A files are allowed.'));
  },
  limits: { fileSize: 300 * 1024 * 1024 },
});

function handleVideoSourceUpload(req: Request, res: Response, next: NextFunction) {
  videoSourceUpload.single('video')(req, res, (err: any) => multerErrorHandler(req, res, err, next));
}

const videoSourceYoutubeSchema = z.object({ youtubeUrl: z.string().min(1) });

router.post('/sessions/parse-source-video', handleVideoSourceUpload, async (req: Request, res: Response) => {
  try {
    if (req.file) {
      if (!isMediaStudioUploadConfigured()) {
        return res.status(501).json({ message: 'Video transcription is not configured yet (GEMINI_API_KEY / ffmpeg).' });
      }
      const result = await transcribeFromUpload(req.file.buffer);
      return res.status(201).json({ data: { rawContent: result.transcript } });
    }

    const parsed = videoSourceYoutubeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Provide either a video file upload or a youtubeUrl.' });
    }
    if (!isMediaStudioYoutubeConfigured()) {
      return res.status(501).json({ message: 'Video transcription is not configured yet (GEMINI_API_KEY).' });
    }
    if (!isValidYoutubeUrl(parsed.data.youtubeUrl)) {
      return res.status(400).json({ message: 'Please provide a valid YouTube video URL.' });
    }
    const result = await transcribeFromYoutube(parsed.data.youtubeUrl);
    res.status(201).json({ data: { rawContent: result.transcript } });
  } catch (err) {
    if (err instanceof MediaStudioError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

// Image source material (photographed textbook page, slide, worksheet) —
// Gemini reads image bytes natively, so this is a one-shot vision
// extraction call (see examProctoringService.extractExamSourceFromImage),
// not a separate OCR step.
const imageSourceUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files (JPG, PNG, WEBP) are allowed.'));
  },
  limits: { fileSize: 15 * 1024 * 1024 },
});

function handleImageSourceUpload(req: Request, res: Response, next: NextFunction) {
  imageSourceUpload.single('image')(req, res, (err: any) => multerErrorHandler(req, res, err, next));
}

router.post('/sessions/parse-source-image', handleImageSourceUpload, async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ message: 'No image was selected.' });
  try {
    const rawContent = await extractExamSourceFromImage({ mimeType: req.file.mimetype, data: req.file.buffer.toString('base64') });
    res.status(201).json({ data: { rawContent } });
  } catch (err) {
    if (err instanceof ExamProctoringAiError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

router.get('/sessions', async (req: Request, res: Response) => {
  const sessions = await prisma.examSession.findMany({
    where: { businessId: req.user!.id },
    include: { _count: { select: { submissions: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: sessions });
});

router.post('/sessions', async (req: Request, res: Response) => {
  if (!isExamProctoringConfigured()) {
    return res.status(501).json({ message: 'AI Exam Proctoring is not configured on this server.' });
  }
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

  res.status(201).json({ data: session });
});

async function loadOwnedSession(sessionId: string, businessId: string) {
  const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
  if (!session || session.businessId !== businessId) return null;
  return session;
}

router.get('/sessions/:id', async (req: Request, res: Response) => {
  const session = await loadOwnedSession(req.params.id, req.user!.id);
  if (!session) return res.status(404).json({ message: 'Exam session not found.' });

  const [questions, submissions] = await Promise.all([
    prisma.examQuestion.findMany({ where: { examSessionId: session.id }, orderBy: { order: 'asc' } }),
    prisma.examSubmission.findMany({
      where: { examSessionId: session.id },
      include: { studyGuide: true },
      orderBy: { startedAt: 'desc' },
    }),
  ]);

  res.json({ data: { ...session, questions, submissions } });
});

router.patch('/sessions/:id', async (req: Request, res: Response) => {
  const session = await loadOwnedSession(req.params.id, req.user!.id);
  if (!session) return res.status(404).json({ message: 'Exam session not found.' });

  const result = updateExamSessionSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const updated = await prisma.examSession.update({ where: { id: session.id }, data: result.data });
  res.json({ data: updated });
});

router.delete('/sessions/:id', async (req: Request, res: Response) => {
  const session = await loadOwnedSession(req.params.id, req.user!.id);
  if (!session) return res.status(404).json({ message: 'Exam session not found.' });

  await prisma.examSession.delete({ where: { id: session.id } });
  res.status(204).send();
});

// ============================================================
// SUBMISSION-LEVEL: PDF report + adaptive retest generation
// ============================================================

async function loadOwnedSubmission(submissionId: string, businessId: string) {
  const submission = await prisma.examSubmission.findUnique({ where: { id: submissionId } });
  if (!submission) return null;
  const session = await prisma.examSession.findUnique({ where: { id: submission.examSessionId } });
  if (!session || session.businessId !== businessId) return null;
  return { submission, session };
}

router.get('/submissions/:id/report.pdf', async (req: Request, res: Response) => {
  const owned = await loadOwnedSubmission(req.params.id, req.user!.id);
  if (!owned) return res.status(404).json({ message: 'Submission not found.' });

  const pdf = await generateExamReportPdf({ session: owned.session, submission: owned.submission });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="exam-report-${owned.submission.id}.pdf"`);
  res.send(pdf);
});

// Generates a fresh ExamSession (new AI question set, new candidateToken)
// scoped to the weak topics from this submission's AdaptiveStudyGuide, for
// the business to send the candidate as a retest. Idempotent-ish: calling
// again replaces the previous retestExamSessionId link rather than piling
// up orphaned retest sessions.
router.post('/submissions/:id/generate-retest', async (req: Request, res: Response) => {
  const owned = await loadOwnedSubmission(req.params.id, req.user!.id);
  if (!owned) return res.status(404).json({ message: 'Submission not found.' });

  const guide = await prisma.adaptiveStudyGuide.findUnique({ where: { examSubmissionId: owned.submission.id } });
  if (!guide) {
    return res.status(400).json({ message: 'No adaptive study guide exists for this submission yet — nothing to retest.' });
  }

  let generated;
  try {
    generated = await generateExamQuestions({
      topic: `${owned.session.topic} — focused retest on: ${(guide.weakTopics as string[]).join('; ')}`,
      mcqCount: Math.min(owned.session.mcqCount, 5),
    });
  } catch (err) {
    const message = err instanceof ExamProctoringAiError ? err.message : 'Failed to generate the retest.';
    const status = err instanceof ExamProctoringAiError ? err.status : 502;
    return res.status(status).json({ message });
  }

  const retestSession = await prisma.examSession.create({
    data: {
      businessId: req.user!.id,
      title: `${owned.session.title} — Retest`,
      description: `Adaptive retest focused on: ${(guide.weakTopics as string[]).join(', ')}`,
      topic: owned.session.topic,
      mcqCount: generated.filter((q) => q.type === 'MCQ').length,
      durationMinutes: owned.session.durationMinutes,
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
  });

  const updatedGuide = await prisma.adaptiveStudyGuide.update({
    where: { id: guide.id },
    data: { retestExamSessionId: retestSession.id },
  });

  res.status(201).json({ data: { studyGuide: updatedGuide, retestSession } });
});

export default router;
