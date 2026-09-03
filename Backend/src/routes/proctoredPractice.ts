import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireApproved } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import {
  isExamProctoringConfigured,
  generateExamQuestions,
  gradePracticalAnswer,
  ExamProctoringAiError,
} from '../services/examProctoringService';

// ============================================================
// AI Proctored PRACTICE Exam — a self-service skill-assessment tool open to
// any authenticated user (Frontend's /dashboard/tools/proctored-exam),
// deliberately separate from the real Business-facing candidate-screening
// system (routes/examProctoring.ts's ExamSession/ExamAttempt, gated to
// verified Client accounts, billed against BillingSubscription usage).
// Reuses that system's own AI question-generation/grading functions (pure,
// no DB/billing coupling inside them) but has no persistence of its own —
// a practice exam a student takes for themselves has no "employer" who
// needs the result stored, so questions/answers/report all just live in
// the browser for this session, same posture as Media Studio's
// no-backend-persistence export flow.
// ============================================================

const router = Router();
router.use(authenticate, requireApproved);

const practiceRateLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 15, message: 'Too many requests. Please wait a few minutes.' });

const LANGUAGE_NAME: Record<'ka' | 'en', string> = { ka: 'Georgian', en: 'English' };

const generateSchema = z.object({
  subject: z.string().min(1).max(200),
  level: z.enum(['JUNIOR', 'MID', 'SENIOR', 'EXPERT']),
  questionCount: z.number().int().min(5).max(10),
  language: z.enum(['ka', 'en']),
});

router.post('/generate', practiceRateLimit, async (req: Request, res: Response) => {
  if (!isExamProctoringConfigured()) return res.status(501).json({ message: 'AI exam generation is not configured yet.' });
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.errors });

  const levelLabel: Record<(typeof parsed.data)['level'], string> = {
    JUNIOR: 'Junior (0-2 years experience)',
    MID: 'Mid-level (2-5 years experience)',
    SENIOR: 'Senior (5+ years experience)',
    EXPERT: 'Expert / principal level',
  };
  // generateExamQuestions()/gradePracticalAnswer() (examProctoringService.ts)
  // have no language parameter of their own — both just embed `topic`
  // verbatim into an English prompt template with no "respond in X"
  // instruction, same for the real Business exam system this reuses. The
  // language directive is folded into `topic` itself instead of forking
  // that shared prompt logic — and since the frontend echoes this same
  // `topic` string back on the grading call for the SAME exam (see
  // proctored-exam.tsx's examTopic state), grading feedback inherits the
  // same language automatically, no separate `language` field needed on
  // the grade-practical route below.
  const topic = `${parsed.data.subject} — ${levelLabel[parsed.data.level]} candidate self-assessment. Write every question, answer option, explanation, and rubric in ${LANGUAGE_NAME[parsed.data.language]}.`;
  // mcqCount + 1 open-ended practical question = the requested total.
  const mcqCount = Math.max(parsed.data.questionCount - 1, 4);

  try {
    const questions = await generateExamQuestions({ topic, mcqCount });
    res.json({ data: { topic, questions } });
  } catch (err) {
    if (err instanceof ExamProctoringAiError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

const gradePracticalSchema = z.object({
  topic: z.string().min(1).max(300),
  questionType: z.enum(['PRACTICAL', 'CODE']),
  question: z.string().min(1).max(4000),
  rubric: z.string().min(1).max(4000),
  answer: z.string().max(20000),
});

router.post('/grade-practical', practiceRateLimit, async (req: Request, res: Response) => {
  if (!isExamProctoringConfigured()) return res.status(501).json({ message: 'AI grading is not configured yet.' });
  const parsed = gradePracticalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.errors });

  try {
    // This tool has no persistence of its own (see header comment) — there's
    // no server-tracked start time to enforce a real deadline against, so
    // the timer check gradePracticalAnswer applies for the real Business
    // exam flow (routes/examProctoring.ts) simply never fires here.
    const result = await gradePracticalAnswer({ ...parsed.data, examEndTime: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    res.json({ data: { score: result.score, feedback: result.feedback } });
  } catch (err) {
    if (err instanceof ExamProctoringAiError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

export default router;
