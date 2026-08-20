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

export default router;
