import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireApproved, requireRole } from '../middleware/auth';
import { generateExamQuestions, AiExamGenerationError, GeneratedQuestion } from '../services/aiExamService';

const router = Router();
router.use(authenticate, requireApproved, requireRole('Student'));

const PASS_THRESHOLD = 80;
const QUESTION_COUNT = 5;

const CATEGORY_BRIEF: Record<string, { title: string; description: string; topics: string[] }> = {
  ui_ux_design: {
    title: 'UI/UX Design Skill Verification',
    description: 'Practical UI/UX design skills for freelance/marketplace work: user research, wireframing, usability heuristics, and design tools (Figma).',
    topics: ['user research', 'wireframing & prototyping', 'usability heuristics', 'accessibility', 'design systems'],
  },
  web_development: {
    title: 'Web Development Skill Verification',
    description: 'Practical web development skills for freelance/marketplace work: HTML/CSS/JS fundamentals, modern frameworks, APIs, and debugging scenarios.',
    topics: ['HTML/CSS fundamentals', 'JavaScript', 'frontend frameworks', 'REST APIs', 'debugging & performance'],
  },
  graphic_design: {
    title: 'Graphic Design Skill Verification',
    description: 'Practical graphic design skills for freelance/marketplace work: composition, color theory, typography, and brand/print vs. digital delivery.',
    topics: ['composition & layout', 'color theory', 'typography', 'branding', 'file formats & delivery'],
  },
  digital_marketing: {
    title: 'Digital Marketing Skill Verification',
    description: 'Practical digital marketing skills for freelance/marketplace work: social media strategy, SEO basics, ad campaigns, and analytics.',
    topics: ['social media strategy', 'SEO fundamentals', 'ad campaign structure', 'content strategy', 'analytics & KPIs'],
  },
  other: {
    title: 'General Freelance Skill Verification',
    description: 'General professional/freelance work skills: client communication, scoping, deadlines, and quality delivery.',
    topics: ['client communication', 'project scoping', 'time management', 'quality assurance', 'professional ethics'],
  },
};

const categorySchema = z.object({
  category: z.enum(['ui_ux_design', 'web_development', 'graphic_design', 'digital_marketing', 'other']),
});

type ClientQuestion = Omit<GeneratedQuestion, 'correctAnswer' | 'explanation'>;
function stripAnswers(questions: GeneratedQuestion[]): ClientQuestion[] {
  return questions.map(({ correctAnswer, explanation, ...rest }) => rest);
}

router.post('/generate', async (req: Request, res: Response) => {
  const result = categorySchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const brief = CATEGORY_BRIEF[result.data.category];
  let questions: GeneratedQuestion[];
  try {
    questions = await generateExamQuestions({
      courseTitle: brief.title,
      courseDescription: brief.description,
      lessonTitles: brief.topics,
      questionCount: QUESTION_COUNT,
    });
  } catch (err) {
    const message = err instanceof AiExamGenerationError ? err.message : 'Failed to generate exam questions.';
    return res.status(502).json({ message });
  }

  const attempt = await prisma.freelancerSkillExamAttempt.create({
    data: { userId: req.user!.id, category: result.data.category, questions: questions as unknown as Prisma.InputJsonValue },
  });

  res.status(201).json({ data: { attemptId: attempt.id, category: attempt.category, questions: stripAnswers(questions) } });
});

const submitSchema = z.object({
  answers: z.record(z.string(), z.enum(['A', 'B', 'C', 'D'])),
});

router.post('/:attemptId/submit', async (req: Request, res: Response) => {
  const result = submitSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const attempt = await prisma.freelancerSkillExamAttempt.findFirst({
    where: { id: req.params.attemptId, userId: req.user!.id },
  });
  if (!attempt) return res.status(404).json({ message: 'Exam attempt not found.' });
  if (attempt.completedAt) return res.status(400).json({ message: 'This exam attempt was already submitted.' });

  const questions = attempt.questions as unknown as GeneratedQuestion[];
  const answers = result.data.answers;
  const correctCount = questions.filter((q) => answers[q.id] === q.correctAnswer).length;
  const score = Math.round((correctCount / questions.length) * 100);
  const passed = score >= PASS_THRESHOLD;

  await prisma.$transaction(async (tx) => {
    await tx.freelancerSkillExamAttempt.update({
      where: { id: attempt.id },
      data: { answers, score, passed, completedAt: new Date() },
    });
    // Reuses the same isVerifiedGraduate flag/badge shown across the
    // marketplace (GigCard/VacancyCard/profile) — deliberately not a
    // second parallel "verified" concept. Only ever flips true, never
    // revokes an existing verification on a failed retake.
    if (passed) {
      await tx.user.update({ where: { id: req.user!.id }, data: { isVerifiedGraduate: true } });
    }
  });

  res.json({
    data: {
      score,
      passed,
      correctCount,
      totalQuestions: questions.length,
      review: questions.map((q) => ({
        id: q.id,
        question: q.question,
        correctAnswer: q.correctAnswer,
        yourAnswer: answers[q.id] ?? null,
        explanation: q.explanation,
      })),
    },
  });
});

export default router;
