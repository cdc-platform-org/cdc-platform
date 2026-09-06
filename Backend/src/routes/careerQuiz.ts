import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { careerQuizSubmitSchema } from '../schemas/careerQuizSchemas';
import { countTodaysSubmissions, generateCareerQuizResult, CareerQuizNotConfiguredError, DAILY_QUIZ_LIMIT } from '../services/careerQuizService';

const router = Router();

// Auth-gated end to end (see /career-test's own client-side guard) — every
// row is tied to a real account so a user can revisit their result from
// /dashboard/career-quiz, and the daily-attempt cap below is meaningful
// (an anonymous quiz has no identity to rate-limit against).
router.post('/submit', authenticate, async (req: Request, res: Response) => {
  const result = careerQuizSubmitSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const submittedToday = await countTodaysSubmissions(req.user!.id);
  if (submittedToday >= DAILY_QUIZ_LIMIT) {
    return res.status(429).json({
      message: `თითოეულ მომხმარებელს შეუძლია ტესტის გავლა დღეში მაქსიმუმ ${DAILY_QUIZ_LIMIT}-ჯერ. სცადეთ ხვალ.`,
      code: 'DAILY_LIMIT_REACHED',
    });
  }

  const lang = req.body?.lang === 'en' ? 'en' : 'ka';
  try {
    const resultText = await generateCareerQuizResult(
      { gender: result.data.gender, age: result.data.age, answers: result.data.answers },
      lang
    );

    const submission = await prisma.careerQuizSubmission.create({
      data: {
        userId: req.user!.id,
        fullName: result.data.fullName,
        email: result.data.email,
        phone: result.data.phone,
        audience: result.data.audience,
        gender: result.data.gender,
        age: result.data.age,
        answers: result.data.answers,
        resultText,
        ref: result.data.ref ?? null,
      },
    });

    res.status(201).json({ data: submission });
  } catch (err) {
    if (err instanceof CareerQuizNotConfiguredError) {
      return res.status(501).json({ message: err.message });
    }
    // Never leaks the raw AI/provider error to the client — same posture as
    // the homepage assistant's chat API. A transient Gemini/Azure failure
    // (rate limit, timeout, malformed response) is common enough on a cold
    // production deploy that this must degrade to a clean, retryable
    // message rather than a raw 500/stack trace reaching the browser.
    console.error('[careerQuiz] generateCareerQuizResult failed:', err instanceof Error ? err.message : err);
    res.status(502).json({ message: 'ტესტის შედეგის გენერირება ვერ მოხერხდა. სცადეთ თავიდან.' });
  }
});

// For the /dashboard/career-quiz "ჩემი კარიერული ტესტი" tab — every past
// result this user has ever gotten, newest first.
router.get('/mine', authenticate, async (req: Request, res: Response) => {
  const submissions = await prisma.careerQuizSubmission.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: submissions });
});

export default router;
