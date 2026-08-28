import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireApproved, requireRole } from '../middleware/auth';
import {
  generateSkillTestQuestions,
  gradePracticalAnswer,
  SkillTestGenerationError,
  SkillQuestion,
  SkillMcqQuestion,
  SkillPracticalQuestion,
  GENERIC_FALLBACK_QUESTIONS,
} from '../services/skillTestService';
import { isDigitalProfession, OUT_OF_SCOPE_MESSAGE } from '../utils/digitalProfessionScope';
import { isPredefinedSkill } from '../data/freelancerSkills';

const router = Router();
router.use(authenticate, requireApproved, requireRole('Student'));

// Matches routes/freelancerExam.ts's PASS_THRESHOLD — same 80% bar, kept as
// an independent constant since these are two separate verification systems
// (see SkillTestAttempt/VerifiedSkill's own schema comments).
const PASS_THRESHOLD = 80;
// Per-question timer enforced client-side (see the UI); the server doesn't
// track elapsed time — a freelancer racing the clock and answering wrong is
// already reflected in the score, and a strict server-side timeout adds
// complexity (clock skew, network latency) for no real anti-cheat benefit
// over the existing score threshold.
const SECONDS_PER_QUESTION = 90;

const GENERIC_FAILURE_MESSAGE = 'ტესტის ჩატვირთვა ვერ მოხერხდა. გთხოვთ სცადოთ მოგვიანებით.';

// CDC's curated skill taxonomy (src/data/freelancerSkills.ts) is always in
// scope — it's already a deliberately-chosen digital/remote-work skill
// list, and several of its own entries ("WordPress", "Photography",
// "Virtual Assistance", ...) don't literally contain any of
// digitalProfessionScope.ts's tech-keyword substrings, so gating on that
// keyword list alone would wrongly reject legitimate pre-approved skills.
// Only a free-typed "Other" skill (not in the curated list) needs the same
// out-of-scope gate routes/freelancerExam.ts already applies to its own
// free-typed customProfession field — this is exactly the gap that let a
// skill like "ელექტრიკი" reach AI exam generation and public verification
// with zero restriction.
export function isSkillNameInScope(skillName: string): boolean {
  return isPredefinedSkill(skillName) || isDigitalProfession(skillName);
}

type ClientMcqQuestion = Omit<SkillMcqQuestion, 'correctAnswer' | 'explanation'>;
type ClientPracticalQuestion = Omit<SkillPracticalQuestion, 'rubric'>;
type ClientQuestion = ClientMcqQuestion | ClientPracticalQuestion;

function stripAnswers(questions: SkillQuestion[]): ClientQuestion[] {
  return questions.map((q) => {
    if (q.type === 'mcq') {
      const { correctAnswer, explanation, ...rest } = q;
      return rest;
    }
    const { rubric, ...rest } = q;
    return rest;
  });
}

const generateSchema = z.object({
  skillName: z.string().trim().min(1).max(80),
  lang: z.enum(['ka', 'en']).optional(),
});

router.post('/generate', async (req: Request, res: Response) => {
  const result = generateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { skillName, lang } = result.data;

  if (!isSkillNameInScope(skillName)) {
    return res.status(400).json({ message: OUT_OF_SCOPE_MESSAGE[lang ?? 'ka'] });
  }

  const alreadyVerified = await prisma.verifiedSkill.findUnique({
    where: { userId_skillName: { userId: req.user!.id, skillName } },
  });
  if (alreadyVerified) {
    return res.status(400).json({ message: 'This skill is already verified.' });
  }

  let questions: SkillQuestion[];
  try {
    questions = await generateSkillTestQuestions(skillName, lang ?? 'ka');
  } catch (err) {
    // AI generator unavailable/misconfigured/erroring — fall back to a
    // generic (not skill-specific) static question bank rather than failing
    // the request outright, same reasoning as freelancerExam.ts.
    if (err instanceof SkillTestGenerationError) {
      questions = GENERIC_FALLBACK_QUESTIONS;
    } else {
      console.error('[skillTests] Unexpected error generating questions:', err);
      return res.status(502).json({ message: GENERIC_FAILURE_MESSAGE });
    }
  }

  let attempt;
  try {
    attempt = await prisma.skillTestAttempt.create({
      data: { userId: req.user!.id, skillName, questions: questions as unknown as Prisma.InputJsonValue },
    });
  } catch (err) {
    console.error('[skillTests] Failed to create test attempt:', err);
    return res.status(500).json({ message: GENERIC_FAILURE_MESSAGE });
  }

  res.status(201).json({
    data: {
      attemptId: attempt.id,
      skillName: attempt.skillName,
      secondsPerQuestion: SECONDS_PER_QUESTION,
      questions: stripAnswers(questions),
    },
  });
});

const submitSchema = z.object({
  // Keyed by question id — mcq answers are 'A'|'B'|'C'|'D', the practical
  // answer is free text. Optional per-question: an unanswered question
  // (timer ran out) just scores as wrong/empty, same as leaving it blank.
  mcqAnswers: z.record(z.string(), z.enum(['A', 'B', 'C', 'D'])),
  practicalAnswer: z.string().trim().max(4000).optional(),
});

router.post('/:attemptId/submit', async (req: Request, res: Response) => {
  const result = submitSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const attempt = await prisma.skillTestAttempt.findFirst({
    where: { id: req.params.attemptId, userId: req.user!.id },
  });
  if (!attempt) return res.status(404).json({ message: 'Test attempt not found.' });
  if (attempt.completedAt) return res.status(400).json({ message: 'This test attempt was already submitted.' });

  const questions = attempt.questions as unknown as SkillQuestion[];
  const mcqQuestions = questions.filter((q): q is SkillMcqQuestion => q.type === 'mcq');
  const practicalQuestion = questions.find((q): q is SkillPracticalQuestion => q.type === 'practical');

  const { mcqAnswers, practicalAnswer } = result.data;
  const correctCount = mcqQuestions.filter((q) => mcqAnswers[q.id] === q.correctAnswer).length;
  const mcqScore = mcqQuestions.length > 0 ? (correctCount / mcqQuestions.length) * 100 : 0;

  // Atomically claim this attempt before grading — a concurrent submit call
  // racing this one (double-click, client retry) can no longer both pass
  // the `attempt.completedAt` check above before either writes: only one
  // request's updateMany actually matches `completedAt: null` and flips it,
  // so a genuine concurrent duplicate is rejected immediately here instead
  // of both calling the billed AI grader and one silently overwriting the
  // other's score/VerifiedSkill result. If grading below fails, the claim
  // is released (completedAt reset to null) so the existing "try again"
  // retry flow still works exactly as before.
  const claim = await prisma.skillTestAttempt.updateMany({
    where: { id: attempt.id, completedAt: null },
    data: { completedAt: new Date() },
  });
  if (claim.count === 0) {
    return res.status(400).json({ message: 'This test attempt was already submitted.' });
  }

  let practicalScore = 0;
  let practicalFeedback: string | null = null;
  if (practicalQuestion) {
    try {
      const grade = await gradePracticalAnswer({
        skillName: attempt.skillName,
        question: practicalQuestion.question,
        rubric: practicalQuestion.rubric,
        answer: practicalAnswer ?? '',
        lang: 'ka',
      });
      practicalScore = grade.score;
      practicalFeedback = grade.feedback;
    } catch (err) {
      // Unlike question generation, there is no non-AI fallback for grading
      // free text — guessing a score here would make a public credential
      // meaningless. Surface a clear, retryable error instead of silently
      // passing/failing the practical portion. Release the claim above so
      // the attempt is submittable again, same as before this attempt ever
      // reached the claim.
      console.error('[skillTests] Failed to grade practical answer:', err);
      await prisma.skillTestAttempt.update({ where: { id: attempt.id }, data: { completedAt: null } });
      return res.status(502).json({ message: 'პასუხის შეფასება ვერ მოხერხდა. გთხოვთ სცადოთ ხელახლა.' });
    }
  }

  // Every question (5 MCQ + 1 practical) is weighted equally, per spec.
  const totalScore = Math.round((mcqScore * mcqQuestions.length + practicalScore) / questions.length);
  const passed = totalScore >= PASS_THRESHOLD;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.skillTestAttempt.update({
        where: { id: attempt.id },
        data: {
          answers: { mcqAnswers, practicalAnswer: practicalAnswer ?? null } as unknown as Prisma.InputJsonValue,
          mcqScore,
          practicalScore,
          totalScore,
          passed,
        },
      });
      if (passed) {
        await tx.verifiedSkill.upsert({
          where: { userId_skillName: { userId: req.user!.id, skillName: attempt.skillName } },
          update: { score: totalScore, verifiedVia: 'AI_TEST', verifiedAt: new Date() },
          create: { userId: req.user!.id, skillName: attempt.skillName, verifiedVia: 'AI_TEST', score: totalScore },
        });
      }
    });
  } catch (err) {
    console.error('[skillTests] Failed to submit test attempt:', err);
    return res.status(500).json({ message: GENERIC_FAILURE_MESSAGE });
  }

  res.json({
    data: {
      mcqScore: Math.round(mcqScore),
      practicalScore: Math.round(practicalScore),
      totalScore,
      passed,
      correctCount,
      totalMcqQuestions: mcqQuestions.length,
      practicalFeedback,
      review: mcqQuestions.map((q) => ({
        id: q.id,
        question: q.question,
        correctAnswer: q.correctAnswer,
        yourAnswer: mcqAnswers[q.id] ?? null,
        explanation: q.explanation,
      })),
    },
  });
});

// This user's declared skills (from User.freelancerSkills), cross-referenced
// with which already have a VerifiedSkill badge — everything the "My
// Skills" dashboard section needs in one call.
router.get('/mine', async (req: Request, res: Response) => {
  const [user, verifiedSkills] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.user!.id }, select: { freelancerSkills: true } }),
    prisma.verifiedSkill.findMany({ where: { userId: req.user!.id } }),
  ]);
  res.json({
    data: {
      declaredSkills: user?.freelancerSkills ?? [],
      verifiedSkills: verifiedSkills.map((v) => ({
        skillName: v.skillName,
        verifiedVia: v.verifiedVia,
        score: v.score,
        verifiedAt: v.verifiedAt,
      })),
    },
  });
});

export default router;
