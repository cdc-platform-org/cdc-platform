import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireApproved, requireRole } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import {
  createExamSessionSchema,
  updateExamSessionSchema,
  startExamAttemptSchema,
  submitExamAttemptSchema,
} from '../schemas/examProctoringSchemas';
import {
  generateExamQuestions,
  gradePracticalAnswer,
  ExamProctoringAiError,
  isExamProctoringConfigured,
} from '../services/examProctoringService';
import { recordExamGradingUsage } from '../services/billingService';

const router = Router();

// A candidate never has (or needs) a CDC account — this strike limit stops
// one visitor from hammering the free-text grading endpoint, same posture
// as chatApi.ts's public widget rate limit.
const candidateRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'Too many requests. Please try again shortly.',
});

// Violations at or above this count force-submits the attempt as FLAGGED —
// same "disqualified" concept as freelancerExam.ts's strike limit, just
// named for what a business reviewing candidate reports needs to see.
const PROCTORING_FLAG_THRESHOLD = 5;

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
  const practicalQuestion = questions.find((q) => q.type === 'PRACTICAL');
  const answers = result.data.answers;

  const mcqCorrectCount = mcqQuestions.filter((q) => answers[q.id] === q.correctAnswer).length;
  const mcqScore = mcqQuestions.length > 0 ? Math.round((mcqCorrectCount / mcqQuestions.length) * 100) : null;

  const disqualified = result.data.disqualified || result.data.proctoringViolations >= PROCTORING_FLAG_THRESHOLD;

  let practicalScore: number | null = null;
  let aiEvaluation: string | null = null;

  // A disqualified (proctoring-flagged) attempt is never graded by AI — the
  // business reviews it manually instead, and this also avoids spending a
  // billed grading call on an attempt that's already being thrown out.
  if (practicalQuestion && !disqualified) {
    const answerText = answers[practicalQuestion.id] ?? '';
    try {
      const grade = await gradePracticalAnswer({
        topic: session.topic,
        question: practicalQuestion.question,
        rubric: practicalQuestion.correctAnswer ?? '',
        answer: answerText,
      });
      practicalScore = grade.score;
      aiEvaluation = grade.feedback;

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
      // recorded — the business sees a null practicalScore/aiEvaluation and
      // can follow up manually, same "never lose the submission" posture as
      // the rest of this codebase's AI-dependent flows.
      console.error('[examProctoring] gradePracticalAnswer failed:', err);
    }
  }

  const scores = [mcqScore, practicalScore].filter((s): s is number => s != null);
  const totalScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  await prisma.examSubmission.update({
    where: { id: submission.id },
    data: {
      answers,
      mcqScore,
      practicalScore,
      totalScore,
      aiEvaluation,
      proctoringViolations: result.data.proctoringViolations,
      status: disqualified ? 'FLAGGED' : 'COMPLETED',
      completedAt: new Date(),
    },
  });

  // Deliberately no score in the response — this is a screening tool for
  // the business, not a self-assessment result for the candidate (unlike
  // freelancerExam.ts, where the taker IS the one being credentialed).
  res.json({ data: { submitted: true } });
});

// ============================================================
// BUSINESS — exam session management + candidate reports
// ============================================================

router.use(authenticate, requireApproved, requireRole('Client', 'SuperAdmin'));

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
    generated = await generateExamQuestions(result.data.topic, result.data.mcqCount);
  } catch (err) {
    const message = err instanceof ExamProctoringAiError ? err.message : 'Failed to generate exam questions.';
    return res.status(502).json({ message });
  }

  const session = await prisma.examSession.create({
    data: {
      businessId: req.user!.id,
      title: result.data.title,
      description: result.data.description ?? null,
      topic: result.data.topic,
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
    prisma.examSubmission.findMany({ where: { examSessionId: session.id }, orderBy: { startedAt: 'desc' } }),
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

export default router;
