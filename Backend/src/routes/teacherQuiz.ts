import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { rateLimit } from '../middleware/rateLimit';
import { getPublicQuiz, submitTeacherQuiz, TeacherQuizError } from '../services/teacherQuizService';

// ============================================================
// PUBLIC — student-facing routes for a shared AI Educator VIP Hub quiz
// (see educatorHub.ts's POST /quizzes and teacherQuizService.ts). A
// student never has a CDC account — addressed purely by the quiz's opaque
// shareToken, same "no-login, unguessable link" posture as
// examProctoring.ts's candidate routes, just without any proctoring.
// ============================================================

const router = Router();

const quizRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'Too many requests. Please try again shortly.',
});

router.get('/:shareToken', quizRateLimit, async (req: Request, res: Response) => {
  const quiz = await getPublicQuiz(req.params.shareToken);
  if (!quiz) return res.status(404).json({ message: 'This quiz link is invalid or has been removed.' });
  res.json({ data: quiz });
});

const submitQuizSchema = z.object({
  studentName: z.string().min(1).max(200),
  answers: z.record(z.string()),
});

router.post('/:shareToken/submit', quizRateLimit, async (req: Request, res: Response) => {
  const parsed = submitQuizSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.errors });

  try {
    const result = await submitTeacherQuiz(req.params.shareToken, parsed.data.studentName, parsed.data.answers);
    res.json({ data: result });
  } catch (err) {
    if (err instanceof TeacherQuizError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

export default router;
