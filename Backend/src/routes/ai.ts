import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { prisma } from '../lib/prisma';
import { checkCourseAccess } from './courses';
import {
  translateBlogPost,
  translateStudioCase,
  translateMentorProfile,
  translateTeamMember,
  translateCourse,
  translateSuccessStory,
  translateTitleAndDescription,
  isAiTranslateConfigured,
  AiTranslateError,
} from '../services/aiTranslateService';
import { generateTutorReply, isCourseTutorConfigured, CourseTutorError } from '../services/courseTutorService';
import { isAiAgentConfigured } from '../services/aiAgentService';
import { generateProductMarketingCopy, ProductMarketingError } from '../services/productMarketingAssistantService';
import {
  getDailyMarketingGenerationUsage,
  hasReachedDailyMarketingGenerationLimit,
  recordMarketingGeneration,
} from '../services/marketingAssistantQuotaService';
import { logAiGeneration } from '../services/aiGenerationLogService';
import { assertOwnedTarget, OwnershipError } from './creatorMarketing';
import { LaunchKitTargetType } from '@prisma/client';

const router = Router();

const translateSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  content: z.string().min(1),
});

const translateStudioCaseSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  fullStory: z.string().min(1),
});

const translateMentorProfileSchema = z.object({
  title: z.string().min(1),
  bio: z.string().min(1),
});

const translateTeamMemberSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  bio: z.string().min(1),
});

const translateSuccessStorySchema = z.object({
  roleTitle: z.string().min(1),
  testimonial: z.string().min(1),
  storyContent: z.string().optional(),
});

const translateTitleDescriptionSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
});

const translateCourseLessonSchema = z.object({
  title: z.string().min(1),
  assignmentPrompt: z.string().optional(),
});

const translateCourseSectionSchema = z.object({
  title: z.string().min(1),
  lessons: z.array(translateCourseLessonSchema).optional(),
});

// All-optional, unlike the schemas above — this endpoint is reused for both
// a course-level translate (title/description) and a per-section translate
// (sections, no title/description) — see aiTranslateService.translateCourse.
const translateCourseSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    sections: z.array(translateCourseSectionSchema).optional(),
  })
  .refine((data) => !!data.title || !!data.description || !!data.sections?.length, {
    message: 'At least one of title, description, or sections is required.',
  });

const courseTutorSchema = z.object({
  courseId: z.string().min(1),
  lessonId: z.string().min(1),
  userMessage: z.string().min(1).max(4000),
  chatHistory: z
    .array(z.object({ role: z.enum(['USER', 'ASSISTANT']), content: z.string() }))
    .max(30)
    .optional()
    .default([]),
});

// Admin-only — used by the "✨ Auto-Translate to English" button in
// /admin/blog. Not exposed publicly since it burns Gemini quota per call.
router.post('/translate', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  if (!isAiTranslateConfigured()) {
    return res.status(501).json({ message: 'AI translation is not configured yet (GEMINI_API_KEY).' });
  }

  const result = translateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  try {
    const translated = await translateBlogPost(result.data);
    res.json({ data: translated });
  } catch (err) {
    if (err instanceof AiTranslateError) {
      return res.status(err.status).json({ message: err.message });
    }
    throw err;
  }
});

// Admin-only — used by the "✨ Auto-Translate to English" button in
// /admin/studio-cases. Not exposed publicly, same reasoning as /translate.
router.post('/translate-studio-case', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  if (!isAiTranslateConfigured()) {
    return res.status(501).json({ message: 'AI translation is not configured yet (GEMINI_API_KEY).' });
  }

  const result = translateStudioCaseSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  try {
    const translated = await translateStudioCase(result.data);
    res.json({ data: translated });
  } catch (err) {
    if (err instanceof AiTranslateError) {
      return res.status(err.status).json({ message: err.message });
    }
    throw err;
  }
});

// Admin-only — used by the "✨ Auto-Translate to English" button on a
// mentor's profile in /admin/mentorship. Not exposed publicly, same
// reasoning as /translate.
router.post('/translate-mentor', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  if (!isAiTranslateConfigured()) {
    return res.status(501).json({ message: 'AI translation is not configured yet (GEMINI_API_KEY).' });
  }

  const result = translateMentorProfileSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  try {
    const translated = await translateMentorProfile(result.data);
    res.json({ data: translated });
  } catch (err) {
    if (err instanceof AiTranslateError) {
      return res.status(err.status).json({ message: err.message });
    }
    throw err;
  }
});

// Admin-only — used by the "✨ Auto-Translate to English" button in
// /admin/team-trainers.
router.post('/translate-team-member', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  if (!isAiTranslateConfigured()) {
    return res.status(501).json({ message: 'AI translation is not configured yet (GEMINI_API_KEY).' });
  }

  const result = translateTeamMemberSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  try {
    const translated = await translateTeamMember(result.data);
    res.json({ data: translated });
  } catch (err) {
    if (err instanceof AiTranslateError) {
      return res.status(err.status).json({ message: err.message });
    }
    throw err;
  }
});

// Admin-only — used by the "✨ Auto-Translate to English via Gemini" button
// in /admin/courses, both at the course level (title/description, from
// CourseForm) and per-section (sections, from CurriculumEditor's
// SectionCard). Not exposed publicly, same reasoning as /translate.
router.post('/translate-course', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  if (!isAiTranslateConfigured()) {
    return res.status(501).json({ message: 'AI translation is not configured yet (GEMINI_API_KEY).' });
  }

  const result = translateCourseSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  try {
    const translated = await translateCourse(result.data);
    res.json({ data: translated });
  } catch (err) {
    if (err instanceof AiTranslateError) {
      return res.status(err.status).json({ message: err.message });
    }
    throw err;
  }
});

// Admin-only manual trigger for the same title+description translation
// products.ts/adminProducts.ts already run automatically (best-effort, no
// button) whenever titleEn/descriptionEn is left blank on save — this lets
// an admin re-run it on demand (e.g. after editing the Georgian title)
// from a button instead of only ever firing implicitly on submit.
router.post('/translate-title-description', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  if (!isAiTranslateConfigured()) {
    return res.status(501).json({ message: 'AI translation is not configured yet (GEMINI_API_KEY).' });
  }

  const result = translateTitleDescriptionSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  try {
    const translated = await translateTitleAndDescription(result.data.title, result.data.description);
    res.json({ data: translated });
  } catch (err) {
    if (err instanceof AiTranslateError) {
      return res.status(err.status).json({ message: err.message });
    }
    throw err;
  }
});

// Admin-only — used by the "✨ Auto-Translate to English" button in
// /admin/success-stories. Not exposed publicly, same reasoning as /translate.
router.post('/translate-success-story', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  if (!isAiTranslateConfigured()) {
    return res.status(501).json({ message: 'AI translation is not configured yet (GEMINI_API_KEY).' });
  }

  const result = translateSuccessStorySchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  try {
    const translated = await translateSuccessStory(result.data);
    res.json({ data: translated });
  } catch (err) {
    if (err instanceof AiTranslateError) {
      return res.status(err.status).json({ message: err.message });
    }
    throw err;
  }
});

// Every logged-in enrolled student (not admin-only, unlike the routes
// above) — this is the student-facing in-course AI Tutor. IP-keyed rate
// limit since a chat endpoint is the obvious abuse target for burning
// Gemini quota; 20 messages/5min is generous for a real study session.
const courseTutorRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: 'Too many tutor messages. Please wait a moment before sending more.',
});

router.post('/course-tutor', authenticate, courseTutorRateLimit, async (req: Request, res: Response) => {
  if (!isCourseTutorConfigured()) {
    return res.status(501).json({ message: 'AI Course Tutor is not configured yet (GEMINI_API_KEY).' });
  }

  const result = courseTutorSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { courseId, lessonId, userMessage, chatHistory } = result.data;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { section: { include: { course: true } } },
  });
  if (!lesson || lesson.section.courseId !== courseId) {
    return res.status(404).json({ message: 'Lesson not found.' });
  }

  const { allowed } = await checkCourseAccess(req.user!.id, courseId);
  if (!allowed) return res.status(403).json({ message: 'You are not enrolled in this course.' });

  try {
    const reply = await generateTutorReply({
      courseTitle: lesson.section.course.title,
      courseDescription: lesson.section.course.description,
      sectionTitle: lesson.section.title,
      lessonTitle: lesson.title,
      assignmentPrompt: lesson.assignmentPrompt,
      resources: lesson.resources,
      history: chatHistory,
      message: userMessage,
    });
    res.json({ reply });
  } catch (err) {
    if (err instanceof CourseTutorError) {
      return res.status(502).json({ message: err.message });
    }
    throw err;
  }
});

// Every approved user (not admin-only) — quick-assist marketing-copy
// generator for the digital-products dashboard tab
// (/dashboard?tab=products). Two independent layers, same "abuse-prevention
// rate limit + real quota check inside the handler" shape as
// aiAgentsSuite.ts's /generate: the IP rate limit below just stops a burst
// of requests; the actual 5/24h budget is
// hasReachedDailyMarketingGenerationLimit, DB-backed so it survives
// restarts/multiple instances (see marketingAssistantQuotaService.ts).
const digitalStoreMarketingRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: 'Too many requests. Please wait a moment before trying again.',
});

const digitalStoreMarketingSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  // Optional — a blank category (e.g. mid-draft, before the category
  // picker has a selection) should never block a quick-assist generation;
  // generateProductMarketingCopy() falls back to a generic category
  // context when this is left out rather than rejecting the request.
  category: z.string().trim().max(100).optional(),
  lang: z.enum(['ka', 'en']).default('ka'),
  // Optional — the button also works while drafting a brand-new,
  // not-yet-saved listing, which has no productId yet. When present, must
  // be owned by the caller (see assertOwnedTarget below).
  productId: z.string().uuid().optional(),
});

// Lets the frontend show an accurate "X/5 today" badge before the user has
// generated anything this session, rather than only learning usage from a
// prior POST's response.
router.get('/digital-store-marketing/usage', authenticate, async (req: Request, res: Response) => {
  const usage = await getDailyMarketingGenerationUsage(req.user!.id);
  res.json({ usage });
});

router.post('/digital-store-marketing', authenticate, digitalStoreMarketingRateLimit, async (req: Request, res: Response) => {
  if (!isAiAgentConfigured()) {
    return res.status(501).json({ message: 'AI Marketing Assistant is not configured yet (GEMINI_API_KEY).' });
  }

  const result = digitalStoreMarketingSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { title, description, category, lang, productId } = result.data;

  if (productId) {
    try {
      await assertOwnedTarget(LaunchKitTargetType.DIGITAL_PRODUCT, productId, req.user!.id);
    } catch (err) {
      if (err instanceof OwnershipError) return res.status(err.status).json({ message: err.message });
      throw err;
    }
  }

  if (await hasReachedDailyMarketingGenerationLimit(req.user!.id)) {
    const usage = await getDailyMarketingGenerationUsage(req.user!.id);
    return res.status(429).json({
      message: `Daily AI Marketing Assistant limit reached (${usage.limit}/24h). Try again tomorrow.`,
      usage,
    });
  }

  try {
    const copy = await generateProductMarketingCopy({ title, description, category: category || undefined, lang });
    await recordMarketingGeneration(req.user!.id, productId);
    const usage = await getDailyMarketingGenerationUsage(req.user!.id);
    logAiGeneration({
      module: 'digital_store_marketing',
      status: 'success',
      inputContext: { userId: req.user!.id, productId },
      outputSummary: copy.title,
    }).catch(() => {});
    res.json({ data: copy, usage });
  } catch (err) {
    logAiGeneration({
      module: 'digital_store_marketing',
      status: 'failed',
      inputContext: { userId: req.user!.id, productId },
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
    }).catch(() => {});
    if (err instanceof ProductMarketingError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

export default router;
