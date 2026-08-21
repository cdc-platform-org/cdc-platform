import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireApproved, requireRole } from '../middleware/auth';
import { generateExamQuestions, GeneratedQuestion } from '../services/aiExamService';

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

const jobCategoryEnum = z.enum(['ui_ux_design', 'web_development', 'graphic_design', 'digital_marketing', 'other']);

// One test can now span multiple professions at once (the Freelancer tab in
// VerificationDrawer offers a multi-select) — categories drives which
// CATEGORY_BRIEF topic lists get blended into a single 15-question prompt;
// customProfession is the free-typed text shown when 'other' is selected,
// folded into the same prompt as an additional topic.
const generateSchema = z.object({
  categories: z.array(jobCategoryEnum).min(1, 'Select at least one profession.').max(5),
  customProfession: z.string().trim().max(80).optional(),
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

// Universal padding pool — used whenever the selected categories' own
// static banks (5 questions each, see FALLBACK_QUESTIONS above) don't add
// up to QUESTION_COUNT on their own (the common case: a single-profession
// selection only yields 5). Deliberately sized to 15 so even the
// pathological case (zero recognized categories, or every category bank
// somehow missing) can still fill a full exam from this array alone,
// without ever repeating a question. Distinct content from
// FALLBACK_QUESTIONS.other (not reused) so selecting "other" alongside
// another profession never shows the same question twice.
const GENERAL_PADDING_QUESTIONS: GeneratedQuestion[] = [
  { id: 'g1', topic: 'negotiation', question: 'A client asks for a lower price than your quote. What is the most professional response?', options: { A: 'Immediately agree to any price to keep the client', B: 'Explain your value and explore adjusting scope, not just cutting price', C: 'Refuse to discuss it further', D: 'Raise the price instead to punish the request' }, correctAnswer: 'B', explanation: 'Professional negotiation focuses on value and scope, not just dropping price on demand.' },
  { id: 'g2', topic: 'teamwork', question: 'When collaborating with other freelancers on a shared project, what best prevents duplicated or conflicting work?', options: { A: 'Everyone works independently with no updates', B: 'Clear task ownership and regular status updates', C: 'Only communicating at the very end', D: 'Avoiding any shared documentation' }, correctAnswer: 'B', explanation: 'Clear ownership plus regular updates keeps collaborators aligned and avoids overlap.' },
  { id: 'g3', topic: 'remote communication', question: 'What is the main benefit of over-communicating status on a remote/async project?', options: { A: 'It wastes the client\'s time', B: 'It reduces uncertainty and builds trust when there is no in-person contact', C: 'It is required by law', D: 'It replaces the need for a contract' }, correctAnswer: 'B', explanation: 'Without in-person cues, proactive updates are what build client trust remotely.' },
  { id: 'g4', topic: 'prioritization', question: 'You have three tasks due the same day for different clients. What should you do first?', options: { A: 'Whichever is easiest, regardless of deadline or impact', B: 'Assess urgency/impact for each and communicate a realistic order to all three clients', C: 'Ignore two of them silently', D: 'Work on all three at once with no plan' }, correctAnswer: 'B', explanation: 'Prioritizing by urgency/impact and communicating proactively is the professional approach.' },
  { id: 'g5', topic: 'handling feedback', question: 'A client gives critical feedback on your delivered work. What is the best reaction?', options: { A: 'Get defensive and argue every point', B: 'Listen, clarify specifics, and revise based on valid points', C: 'Ignore the feedback entirely', D: 'Stop responding to the client' }, correctAnswer: 'B', explanation: 'Constructive handling of feedback means listening, clarifying, and acting on valid points.' },
  { id: 'g6', topic: 'contracts & invoicing', question: 'Why should a freelancer use a written agreement before starting paid work?', options: { A: 'It is only useful for large companies', B: 'It clearly defines deliverables, payment terms, and protects both sides', C: 'It slows down the project unnecessarily', D: 'It is optional once you trust the client' }, correctAnswer: 'B', explanation: 'A written agreement protects both parties by clarifying scope and payment terms upfront.' },
  { id: 'g7', topic: 'logical reasoning', question: 'If all verified freelancers on a platform pass a skill exam, and Ana passed the skill exam, what can you logically conclude?', options: { A: 'Ana is definitely verified', B: 'Ana might be verified, but passing alone does not guarantee it', C: 'Ana is not verified', D: 'Nothing can be concluded at all' }, correctAnswer: 'B', explanation: 'Passing the exam is presented as a necessary condition among verified freelancers, not proven sufficient on its own from the statement given.' },
  { id: 'g8', topic: 'adaptability', question: 'Midway through a project, a client changes a core requirement. What is the best first step?', options: { A: 'Refuse any changes outright', B: 'Assess the impact on scope/timeline/price and discuss it with the client', C: 'Silently absorb the extra work for free', D: 'Abandon the project' }, correctAnswer: 'B', explanation: 'Requirement changes should be assessed for impact and discussed, not silently absorbed or refused outright.' },
  { id: 'g9', topic: 'organization & tools', question: 'What is the main benefit of using a dedicated task/project tracking tool across multiple clients?', options: { A: 'It guarantees more clients automatically', B: 'It keeps deliverables, deadlines, and communication organized in one place', C: 'It replaces the need for direct client communication', D: 'It is only useful for large teams' }, correctAnswer: 'B', explanation: 'Tracking tools help keep multi-client work organized, reducing missed deadlines or lost context.' },
  { id: 'g10', topic: 'conflict resolution', question: 'A client disputes the quality of delivered work you believe meets the agreed spec. What is the best approach?', options: { A: 'Immediately issue a full refund without discussion', B: 'Calmly review the agreed spec together and address any genuine gaps', C: 'Refuse to discuss it and end communication', D: 'Publicly argue with the client online' }, correctAnswer: 'B', explanation: 'Reviewing the agreed spec together is the professional way to resolve a quality dispute.' },
  { id: 'g11', topic: 'goal setting', question: 'What makes a project milestone useful for tracking freelance work?', options: { A: 'It is vague so it is always technically met', B: 'It is specific and measurable, with a clear deadline', C: 'It only exists in the freelancer\'s head', D: 'It never changes even if the project scope changes' }, correctAnswer: 'B', explanation: 'Useful milestones are specific, measurable, and time-bound.' },
  { id: 'g12', topic: 'problem solving', question: 'You hit an unexpected technical blocker with no clear solution. What is the most effective next step?', options: { A: 'Stop working and say nothing to the client', B: 'Break the problem into smaller parts and research or ask for help on the specific blocker', C: 'Guess randomly until something works with no documentation', D: 'Immediately quit the project' }, correctAnswer: 'B', explanation: 'Breaking a blocker into smaller, researchable parts is a systematic way to solve it.' },
  { id: 'g13', topic: 'professionalism', question: 'What best demonstrates professionalism when you make a mistake on a project?', options: { A: 'Hiding the mistake and hoping no one notices', B: 'Owning the mistake, informing the client, and proposing a fix', C: 'Blaming a teammate or the client instead', D: 'Deleting all evidence of the work' }, correctAnswer: 'B', explanation: 'Owning mistakes and proposing fixes is the professional response, not hiding or blaming.' },
  { id: 'g14', topic: 'client onboarding', question: 'What is the most useful thing to clarify with a new client before work begins?', options: { A: 'Their favorite color scheme only', B: 'Scope, deliverables, timeline, and how/when to communicate', C: 'Nothing — figure it out as you go', D: 'Only the final price, nothing else' }, correctAnswer: 'B', explanation: 'Clarifying scope, deliverables, timeline, and communication upfront prevents most later disputes.' },
  { id: 'g15', topic: 'work-life boundaries', question: 'What is a sustainable way for a freelancer to handle client messages outside agreed working hours?', options: { A: 'Respond instantly at all hours forever', B: 'Set and communicate clear availability windows, then hold to them', C: 'Never respond to any message ever', D: 'Only work at night with no fixed hours' }, correctAnswer: 'B', explanation: 'Clear, communicated availability windows are a sustainable way to manage client expectations.' },
];

router.get('/status', async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { examLockedUntil: true } });
  const lockedUntil = user?.examLockedUntil && user.examLockedUntil > new Date() ? user.examLockedUntil : null;
  res.json({ data: { examLockedUntil: lockedUntil } });
});

router.post('/generate', async (req: Request, res: Response) => {
  const result = generateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { categories, customProfession, lang } = result.data;

  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { examLockedUntil: true } });
  if (user?.examLockedUntil && user.examLockedUntil > new Date()) {
    return res.status(403).json({ message: 'ტესტირება დაბლოკილია დარღვევების გამო.', examLockedUntil: user.examLockedUntil });
  }

  // Blend every selected profession's brief into one prompt so a single
  // 15-question test spans all of them, rather than one test per profession.
  const briefs = categories.map((c) => CATEGORY_BRIEF[c]);
  const combinedTitle = briefs.map((b) => b.title).join(' + ');
  const combinedDescription = briefs.map((b) => b.description).join(' ');
  const combinedTopics = briefs.flatMap((b) => b.topics);
  if (customProfession) combinedTopics.push(customProfession);

  let questions: GeneratedQuestion[];
  try {
    questions = await generateExamQuestions({
      courseTitle: customProfession ? `${combinedTitle} + ${customProfession}` : combinedTitle,
      courseDescription: combinedDescription,
      lessonTitles: combinedTopics,
      questionCount: QUESTION_COUNT,
      lang: lang ?? 'ka',
    });
  } catch (err) {
    // AI generator unavailable/misconfigured/erroring (both the Gemini
    // fallback chain AND, if configured, the Azure OpenAI cross-vendor rung
    // — see aiExamService.ts's callTextModel() — already exhausted) — fall
    // back to the static question bank rather than failing the request
    // outright. Each selected category's bank only has 5 questions, so a
    // 1- or 2-profession selection interleaves to fewer than QUESTION_COUNT;
    // GENERAL_PADDING_QUESTIONS above fills the rest so the user always
    // gets exactly QUESTION_COUNT, never a short or failed test — including
    // the pathological case of zero recognized categories, where padding
    // alone (all 15) carries the entire exam.
    console.error('[freelancerExam] AI generation failed, using static fallback:', err instanceof Error ? err.message : err);
    const banks = categories.map((c) => FALLBACK_QUESTIONS[c]).filter((b): b is GeneratedQuestion[] => !!b);
    const interleaved: GeneratedQuestion[] = [];
    for (let i = 0; interleaved.length < QUESTION_COUNT && banks.some((b) => i < b.length); i++) {
      for (const bank of banks) {
        if (i < bank.length) interleaved.push(bank[i]);
      }
    }
    if (interleaved.length < QUESTION_COUNT) {
      interleaved.push(...GENERAL_PADDING_QUESTIONS.slice(0, QUESTION_COUNT - interleaved.length));
    }
    questions = interleaved.slice(0, QUESTION_COUNT).map((q, i) => ({ ...q, id: `f${i + 1}` }));
  }

  let attempt;
  try {
    attempt = await prisma.freelancerSkillExamAttempt.create({
      data: {
        userId: req.user!.id,
        category: categories[0],
        categories,
        customProfession: customProfession || null,
        questions: questions as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    // Never let a DB-layer failure (e.g. connection issue, schema drift)
    // surface as a bare unstyled 500 — always return a clean, catchable
    // JSON error so the frontend can show a real message + retry option.
    console.error('[freelancerExam] Failed to create exam attempt:', err);
    return res.status(500).json({ message: GENERIC_FAILURE_MESSAGE });
  }

  res.status(201).json({
    data: {
      attemptId: attempt.id,
      categories: attempt.categories,
      customProfession: attempt.customProfession,
      questions: stripAnswers(questions),
    },
  });
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
