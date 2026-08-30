import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireApproved, requireCurrentEducatorSession } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { multerErrorHandler } from '../middleware/productUploads';
import { hasEducatorVipAccess } from '../utils/educatorVipAccess';
import { startEducatorVipTrial, EducatorTrialAlreadyUsedError, EDUCATOR_TRIAL_DAYS } from '../services/educatorVipService';
import { getEducatorUsage, hasReachedGenerationLimit, hasReachedGradingLimit, recordEducatorGeneration } from '../services/educatorUsageService';
import {
  isAiAgentConfigured,
  generateTestAndAnswerKey,
  generateRubric,
  gradeHomework,
  EducatorAiError,
} from '../services/educatorHubAiService';

const router = Router();
router.use(authenticate, requireApproved);

// ---- VIP access gate — applied only to the 3 real generation routes below,
// not /state or /trial/start (a non-VIP visitor still needs to see their
// own trial-availability status and be able to start the trial). ----
async function requireEducatorVipAccess(req: Request, res: Response, next: NextFunction) {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { role: true, educatorVipActive: true, educatorVipTrialEndDate: true },
  });
  if (!user || !hasEducatorVipAccess(user)) {
    return res.status(403).json({
      code: 'VIP_REQUIRED',
      message: 'AI Educator VIP-ს გამოსაყენებლად საჭიროა აქტიური გამოწერა ან საცდელი პერიოდი.',
    });
  }
  next();
}

const generateRateLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 20, message: 'Too many generation requests. Please wait a few minutes.' });

// GET /state — VIP status, trial availability, and current usage, so the
// frontend can render the correct CTA (start trial / usage meter / upsell)
// before the teacher has generated anything this session. Same reasoning
// as englishTutor.ts's own GET /state.
router.get('/state', async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { role: true, educatorVipActive: true, educatorVipTrialStartDate: true, educatorVipTrialEndDate: true },
  });
  if (!user) return res.status(404).json({ message: 'User not found.' });

  const hasAccess = hasEducatorVipAccess(user);
  const trialActive = !!user.educatorVipTrialEndDate && user.educatorVipTrialEndDate.getTime() > Date.now();
  const usage = hasAccess ? await getEducatorUsage(req.user!.id) : null;

  res.json({
    data: {
      hasAccess,
      isVipActive: user.educatorVipActive,
      trialAvailable: !user.educatorVipTrialStartDate,
      trialActive,
      educatorVipTrialEndDate: user.educatorVipTrialEndDate,
      usage,
    },
  });
});

// Cardless 5-day trial — POST-only, one-time. No card/payment step at all.
router.post('/trial/start', async (req: Request, res: Response) => {
  try {
    const { educatorVipTrialEndDate } = await startEducatorVipTrial(req.user!.id);
    res.status(201).json({ data: { educatorVipTrialEndDate, trialDays: EDUCATOR_TRIAL_DAYS } });
  } catch (err) {
    if (err instanceof EducatorTrialAlreadyUsedError) return res.status(400).json({ message: err.message });
    throw err;
  }
});

function handleAiError(err: unknown, res: Response) {
  if (err instanceof EducatorAiError) return res.status(err.status).json({ message: err.message });
  throw err;
}

// ---- Module 1: Smart Test & Answer Key Generator ----

// multipart/form-data (not JSON) since an optional source photo/PDF page can
// ride along — same shape as Module 3's homeworkUpload below, just a wider
// mimetype allowlist since Gemini's vision input natively reads PDF pages
// (including scanned ones) the same way it reads an image, no separate
// OCR/text-extraction step needed.
const testSourceUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, WEBP images or PDF files are allowed.'));
  },
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

function handleTestSourceUpload(req: Request, res: Response, next: NextFunction) {
  testSourceUpload.single('sourceFile')(req, res, (err: any) => multerErrorHandler(req, res, err, next));
}

const generateTestSchema = z.object({
  subject: z.string().min(1).max(200),
  grade: z.string().min(1).max(50),
  topic: z.string().min(1).max(500),
  // Sent as a JSON-encoded string since this is now a multipart form body,
  // not JSON — every field arrives as a string.
  questionTypes: z
    .string()
    .transform((raw, ctx) => {
      try {
        return JSON.parse(raw);
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'questionTypes must be a JSON array.' });
        return z.NEVER;
      }
    })
    .pipe(z.array(z.enum(['MULTIPLE_CHOICE', 'OPEN', 'MATCHING'])).min(1)),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'MIXED']),
  questionCount: z.coerce.number().int().min(1).max(30),
  language: z.enum(['ka', 'en']),
  sourceText: z.string().max(12000).optional(),
});

router.post(
  '/generate-test',
  generateRateLimit,
  requireCurrentEducatorSession,
  requireEducatorVipAccess,
  handleTestSourceUpload,
  async (req: Request, res: Response) => {
    if (!isAiAgentConfigured()) return res.status(501).json({ message: 'AI generation is not configured yet.' });
    const parsed = generateTestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.errors });

    if (await hasReachedGenerationLimit(req.user!.id)) {
      return res.status(429).json({ code: 'QUOTA_EXCEEDED', message: 'ამ თვის გენერაციების ლიმიტი ამოწურულია.' });
    }

    try {
      const result = await generateTestAndAnswerKey({
        ...parsed.data,
        sourceFile: req.file ? { mimeType: req.file.mimetype, data: req.file.buffer.toString('base64') } : undefined,
      });
      await recordEducatorGeneration(req.user!.id, 'TEST_GENERATOR');
      res.json({ data: result });
    } catch (err) {
      handleAiError(err, res);
    }
  }
);

// ---- Module 2: Assessment Rubrics & Matrix Builder ----

const generateRubricSchema = z.object({
  subject: z.string().min(1).max(200),
  grade: z.string().min(1).max(50),
  assessmentType: z.enum(['FORMATIVE', 'SUMMATIVE', 'DIAGNOSTIC', 'PROJECT']),
  skillOrTopic: z.string().min(1).max(500),
  scoringScale: z.string().min(1).max(200),
  language: z.enum(['ka', 'en']),
});

router.post('/generate-rubric', generateRateLimit, requireCurrentEducatorSession, requireEducatorVipAccess, async (req: Request, res: Response) => {
  if (!isAiAgentConfigured()) return res.status(501).json({ message: 'AI generation is not configured yet.' });
  const parsed = generateRubricSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.errors });

  if (await hasReachedGenerationLimit(req.user!.id)) {
    return res.status(429).json({ code: 'QUOTA_EXCEEDED', message: 'ამ თვის გენერაციების ლიმიტი ამოწურულია.' });
  }

  try {
    const result = await generateRubric(parsed.data);
    await recordEducatorGeneration(req.user!.id, 'RUBRIC');
    res.json({ data: result });
  } catch (err) {
    handleAiError(err, res);
  }
});

// ---- Module 3: Automated Homework Grading & Feedback Writer ----

const homeworkUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, or WEBP images are allowed.'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

function handleHomeworkUpload(req: Request, res: Response, next: NextFunction) {
  homeworkUpload.single('studentWork')(req, res, (err: any) => multerErrorHandler(req, res, err, next));
}

const gradeHomeworkSchema = z.object({
  assignmentPrompt: z.string().min(1).max(4000),
  studentWorkText: z.string().max(20000).optional(),
  gradingScale: z.string().min(1).max(100),
  language: z.enum(['ka', 'en']),
});

router.post(
  '/grade-homework',
  generateRateLimit,
  requireCurrentEducatorSession,
  requireEducatorVipAccess,
  handleHomeworkUpload,
  async (req: Request, res: Response) => {
    if (!isAiAgentConfigured()) return res.status(501).json({ message: 'AI generation is not configured yet.' });
    const parsed = gradeHomeworkSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.errors });
    if (!req.file && !parsed.data.studentWorkText) {
      return res.status(400).json({ message: 'Provide the student work as text or as an uploaded image.' });
    }

    if (await hasReachedGradingLimit(req.user!.id)) {
      return res.status(429).json({ code: 'QUOTA_EXCEEDED', message: 'ამ თვის გასწორებების ლიმიტი ამოწურულია.' });
    }

    try {
      const result = await gradeHomework({
        assignmentPrompt: parsed.data.assignmentPrompt,
        studentWorkText: parsed.data.studentWorkText,
        studentWorkImage: req.file ? { mimeType: req.file.mimetype, data: req.file.buffer.toString('base64') } : undefined,
        gradingScale: parsed.data.gradingScale,
        language: parsed.data.language,
      });
      await recordEducatorGeneration(req.user!.id, 'GRADING');
      res.json({ data: result });
    } catch (err) {
      handleAiError(err, res);
    }
  }
);

export default router;
