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
    // AUDIT NOTE (fixed): generateCareerQuizResult() used to throw on any
    // AI-provider failure (missing config, Gemini/Azure both down), landing
    // here as a 501/502 the visitor saw as "ტესტის შედეგის გენერირება ვერ
    // მოხერხდა" — reported live on production, 2026-09-06/07. It now runs a
    // full Tier 1 (Gemini) -> Tier 2 (Azure) -> Tier 3 (local deterministic
    // engine, see careerQuizFallbackEngine.ts) pipeline internally and
    // always resolves with a real report, so this catch block should now
    // only ever fire for a genuine unexpected failure — e.g. the database
    // write itself failing — which a clean 502 is still the right response
    // for; it's just no longer the AI-availability escape hatch it used to
    // be. CareerQuizNotConfiguredError is kept only for defensive
    // completeness (no code path raises it anymore).
    if (err instanceof CareerQuizNotConfiguredError) {
      return res.status(501).json({ message: err.message });
    }
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
