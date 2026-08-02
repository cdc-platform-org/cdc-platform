import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireApproved, requireRole } from '../middleware/auth';
import { generateExamQuestions, AiExamGenerationError, GeneratedQuestion } from '../services/aiExamService';

const router = Router();
router.use(authenticate, requireApproved, requireRole('Student'));

const PASS_THRESHOLD = 80;
const QUESTION_COUNT = 15;

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
  lang: z.enum(['ka', 'en']).optional(),
});

type ClientQuestion = Omit<GeneratedQuestion, 'correctAnswer' | 'explanation'>;
function stripAnswers(questions: GeneratedQuestion[]): ClientQuestion[] {
  return questions.map(({ correctAnswer, explanation, ...rest }) => rest);
}

const GENERIC_FAILURE_MESSAGE = 'ტესტების ჩატვირთვა ვერ მოხერხდა. გთხოვთ სცადოთ მოგვიანებით.';

// Static per-category question bank — used whenever the AI generator is
// unavailable (no GEMINI_API_KEY, quota exhausted, request failure, or a
// malformed response) so a Gemini outage never turns into a hard failure
// for the user. Deliberately not a placeholder: real questions, scored the
// same way as AI-generated ones.
const FALLBACK_QUESTIONS: Record<string, GeneratedQuestion[]> = {
  ui_ux_design: [
    { id: 'f1', topic: 'user research', question: 'What is the primary goal of conducting user interviews before designing a product?', options: { A: 'To validate the visual style guide', B: 'To understand real user needs and pain points', C: 'To finalize the color palette', D: 'To write marketing copy' }, correctAnswer: 'B', explanation: 'User interviews surface real needs and pain points that should drive design decisions.' },
    { id: 'f2', topic: 'wireframing & prototyping', question: 'What is the main purpose of a low-fidelity wireframe?', options: { A: 'To showcase final pixel-perfect visuals', B: 'To quickly test layout and structure before visual design', C: 'To replace user testing', D: 'To define the brand color palette' }, correctAnswer: 'B', explanation: 'Low-fidelity wireframes let teams iterate on structure cheaply before investing in visuals.' },
    { id: 'f3', topic: 'usability heuristics', question: "Which of Nielsen's usability heuristics refers to keeping users informed about what is going on?", options: { A: 'Aesthetic and minimalist design', B: 'Visibility of system status', C: 'Error prevention', D: 'Consistency and standards' }, correctAnswer: 'B', explanation: 'Visibility of system status means the interface should always keep users informed via feedback.' },
    { id: 'f4', topic: 'accessibility', question: 'Why is sufficient color contrast important in UI design?', options: { A: 'It makes the design look more colorful', B: 'It ensures readability for users with visual impairments', C: 'It reduces file size', D: 'It is only a legal formality with no real effect' }, correctAnswer: 'B', explanation: 'Adequate contrast is essential for readability, especially for low-vision users.' },
    { id: 'f5', topic: 'design systems', question: 'What is the main benefit of using a design system across a product?', options: { A: 'It removes the need for user testing', B: 'It ensures visual and behavioral consistency across the product', C: 'It automatically writes the frontend code', D: 'It replaces the need for a style guide' }, correctAnswer: 'B', explanation: 'A design system provides reusable components/patterns that keep the product consistent.' },
  ],
  web_development: [
    { id: 'f1', topic: 'HTML/CSS fundamentals', question: 'Which CSS property is used to control the spacing between an element\'s border and its content?', options: { A: 'margin', B: 'padding', C: 'gap', D: 'outline' }, correctAnswer: 'B', explanation: 'Padding controls the space inside an element, between its border and its content.' },
    { id: 'f2', topic: 'JavaScript', question: 'What does the following expression evaluate to: typeof null?', options: { A: '"null"', B: '"undefined"', C: '"object"', D: '"boolean"' }, correctAnswer: 'C', explanation: 'A well-known JavaScript quirk: typeof null returns "object".' },
    { id: 'f3', topic: 'frontend frameworks', question: 'In component-based frontend frameworks (e.g. React), what is "props" primarily used for?', options: { A: 'Storing global application state permanently', B: 'Passing data from a parent component to a child component', C: 'Styling components with CSS', D: 'Making HTTP requests' }, correctAnswer: 'B', explanation: 'Props pass data down from parent to child components.' },
    { id: 'f4', topic: 'REST APIs', question: 'Which HTTP method is conventionally used to partially update an existing resource?', options: { A: 'GET', B: 'POST', C: 'PATCH', D: 'DELETE' }, correctAnswer: 'C', explanation: 'PATCH is used for partial updates; PUT typically replaces the whole resource.' },
    { id: 'f5', topic: 'debugging & performance', question: 'What is a common cause of a memory leak in a single-page application?', options: { A: 'Using semantic HTML tags', B: 'Forgetting to remove event listeners when a component unmounts', C: 'Minifying CSS files', D: 'Using HTTPS instead of HTTP' }, correctAnswer: 'B', explanation: 'Event listeners or subscriptions left attached after unmount keep references alive, leaking memory.' },
  ],
  graphic_design: [
    { id: 'f1', topic: 'composition & layout', question: 'What design principle divides a composition into a 3x3 grid to guide placement of focal points?', options: { A: 'Golden ratio', B: 'Rule of thirds', C: 'Negative space', D: 'Color theory' }, correctAnswer: 'B', explanation: 'The rule of thirds is a common compositional guideline placing key elements along grid lines/intersections.' },
    { id: 'f2', topic: 'color theory', question: 'Which pair of colors is considered complementary on a standard color wheel?', options: { A: 'Red and orange', B: 'Blue and green', C: 'Red and green', D: 'Yellow and orange' }, correctAnswer: 'C', explanation: 'Complementary colors sit opposite each other on the color wheel, e.g. red and green.' },
    { id: 'f3', topic: 'typography', question: 'What does "kerning" refer to in typography?', options: { A: 'The overall size of a font', B: 'The spacing between two specific characters', C: 'The line height of a paragraph', D: 'The choice of font family' }, correctAnswer: 'B', explanation: 'Kerning adjusts the spacing between specific pairs of characters.' },
    { id: 'f4', topic: 'branding', question: 'What is the primary purpose of a brand style guide?', options: { A: 'To list competitor products', B: 'To ensure consistent visual identity across all materials', C: 'To track project deadlines', D: 'To manage client invoices' }, correctAnswer: 'B', explanation: 'A style guide documents visual rules (logo, colors, type) to keep brand usage consistent.' },
    { id: 'f5', topic: 'file formats & delivery', question: 'Which file format is best suited for a logo that needs to be scaled to any size without losing quality?', options: { A: 'JPEG', B: 'PNG', C: 'SVG (vector)', D: 'GIF' }, correctAnswer: 'C', explanation: 'SVG is a vector format that scales infinitely without quality loss, ideal for logos.' },
  ],
  digital_marketing: [
    { id: 'f1', topic: 'social media strategy', question: 'What is the main purpose of defining a target audience before running a social media campaign?', options: { A: 'To increase server capacity', B: 'To tailor content and targeting for better engagement/ROI', C: 'To reduce the number of required posts', D: 'To automatically improve SEO rankings' }, correctAnswer: 'B', explanation: 'Knowing your audience lets you tailor messaging and targeting for better results.' },
    { id: 'f2', topic: 'SEO fundamentals', question: 'What does a meta description primarily influence?', options: { A: 'The page\'s load speed', B: 'The click-through rate from search results', C: 'The server\'s response code', D: 'The domain\'s registration date' }, correctAnswer: 'B', explanation: 'A compelling meta description can improve click-through rate from search results, though it is not a direct ranking factor.' },
    { id: 'f3', topic: 'ad campaign structure', question: 'In a typical paid ad account structure, what sits directly below a "Campaign"?', options: { A: 'Ad Group / Ad Set', B: 'Landing Page', C: 'Billing Account', D: 'Pixel' }, correctAnswer: 'A', explanation: 'Campaigns contain Ad Groups/Ad Sets, which in turn contain individual ads.' },
    { id: 'f4', topic: 'content strategy', question: 'What is the main benefit of a content calendar?', options: { A: 'It guarantees higher conversion rates automatically', B: 'It helps plan and organize content publishing consistently', C: 'It replaces the need for analytics', D: 'It is required by law for businesses' }, correctAnswer: 'B', explanation: 'A content calendar helps teams plan and stay consistent with publishing.' },
    { id: 'f5', topic: 'analytics & KPIs', question: 'Which metric best measures how many people took a desired action out of total visitors?', options: { A: 'Bounce rate', B: 'Conversion rate', C: 'Page load time', D: 'Domain authority' }, correctAnswer: 'B', explanation: 'Conversion rate measures the percentage of visitors who complete a desired action.' },
  ],
  other: [
    { id: 'f1', topic: 'client communication', question: 'When a client requests work outside the agreed scope, what is the best first step?', options: { A: 'Silently do the extra work for free', B: 'Ignore the request', C: 'Discuss it and clarify pricing/timeline before proceeding', D: 'Immediately end the contract' }, correctAnswer: 'C', explanation: 'Scope changes should be discussed and agreed on (pricing/timeline) before proceeding.' },
    { id: 'f2', topic: 'project scoping', question: 'What is the main purpose of a project scope document?', options: { A: 'To track personal expenses', B: 'To clearly define deliverables, timeline, and boundaries of a project', C: 'To replace a contract entirely', D: 'To advertise the freelancer\'s services' }, correctAnswer: 'B', explanation: 'A scope document defines what is (and is not) included in the project.' },
    { id: 'f3', topic: 'time management', question: 'Which practice most helps a freelancer avoid missing deadlines across multiple clients?', options: { A: 'Accepting unlimited simultaneous projects', B: 'Tracking tasks/deadlines with a planner or project management tool', C: 'Avoiding any written agreements', D: 'Working exclusively at night' }, correctAnswer: 'B', explanation: 'Tracking tasks and deadlines systematically reduces the risk of missing them.' },
    { id: 'f4', topic: 'quality assurance', question: 'Before delivering final work to a client, what should a freelancer typically do?', options: { A: 'Skip review to save time', B: 'Review/test the deliverable against the agreed requirements', C: 'Ask the client to test everything themselves first', D: 'Send it without checking file formats' }, correctAnswer: 'B', explanation: 'Reviewing work against requirements before delivery catches issues early.' },
    { id: 'f5', topic: 'professional ethics', question: 'If a freelancer cannot meet an agreed deadline, what is the most professional approach?', options: { A: 'Say nothing until the deadline passes', B: 'Proactively inform the client as early as possible and propose a new timeline', C: 'Blame the client for the delay', D: 'Disappear and stop responding' }, correctAnswer: 'B', explanation: 'Proactive, early communication is the professional way to handle a missed deadline.' },
  ],
};

router.get('/status', async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { examLockedUntil: true } });
  const lockedUntil = user?.examLockedUntil && user.examLockedUntil > new Date() ? user.examLockedUntil : null;
  res.json({ data: { examLockedUntil: lockedUntil } });
});

router.post('/generate', async (req: Request, res: Response) => {
  const result = categorySchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { examLockedUntil: true } });
  if (user?.examLockedUntil && user.examLockedUntil > new Date()) {
    return res.status(403).json({ message: 'ტესტირება დაბლოკილია დარღვევების გამო.', examLockedUntil: user.examLockedUntil });
  }

  const brief = CATEGORY_BRIEF[result.data.category];
  let questions: GeneratedQuestion[];
  try {
    questions = await generateExamQuestions({
      courseTitle: brief.title,
      courseDescription: brief.description,
      lessonTitles: brief.topics,
      questionCount: QUESTION_COUNT,
      lang: result.data.lang ?? 'ka',
    });
  } catch (err) {
    // AI generator unavailable/misconfigured/erroring — fall back to the
    // static question bank rather than failing the request outright.
    const fallback = FALLBACK_QUESTIONS[result.data.category];
    if (!fallback) {
      const message = err instanceof AiExamGenerationError ? err.message : GENERIC_FAILURE_MESSAGE;
      return res.status(502).json({ message });
    }
    questions = fallback;
  }

  let attempt;
  try {
    attempt = await prisma.freelancerSkillExamAttempt.create({
      data: { userId: req.user!.id, category: result.data.category, questions: questions as unknown as Prisma.InputJsonValue },
    });
  } catch (err) {
    // Never let a DB-layer failure (e.g. connection issue, schema drift)
    // surface as a bare unstyled 500 — always return a clean, catchable
    // JSON error so the frontend can show a real message + retry option.
    console.error('[freelancerExam] Failed to create exam attempt:', err);
    return res.status(500).json({ message: GENERIC_FAILURE_MESSAGE });
  }

  res.status(201).json({ data: { attemptId: attempt.id, category: attempt.category, questions: stripAnswers(questions) } });
});

const EXAM_LOCK_HOURS = 24;

const submitSchema = z.object({
  answers: z.record(z.string(), z.enum(['A', 'B', 'C', 'D'])),
  // Set by the frontend when this submission was forced by hitting the
  // tab-switch/fullscreen-exit strike limit (see exam.tsx's registerStrike)
  // rather than a normal completed attempt — triggers the 24h lockout below.
  disqualified: z.boolean().optional(),
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
  const passed = !result.data.disqualified && score >= PASS_THRESHOLD;
  const examLockedUntil = result.data.disqualified
    ? new Date(Date.now() + EXAM_LOCK_HOURS * 60 * 60 * 1000)
    : null;

  try {
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
      } else if (examLockedUntil) {
        await tx.user.update({ where: { id: req.user!.id }, data: { examLockedUntil } });
      }
    });
  } catch (err) {
    console.error('[freelancerExam] Failed to submit exam attempt:', err);
    return res.status(500).json({ message: GENERIC_FAILURE_MESSAGE });
  }

  res.json({
    data: {
      score,
      passed,
      correctCount,
      totalQuestions: questions.length,
      examLockedUntil,
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
