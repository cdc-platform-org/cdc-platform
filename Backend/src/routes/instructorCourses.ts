import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, requireApproved } from '../middleware/auth';
import { uploadImage } from '../services/imageStorage';
import {
  createBunnyVideo,
  uploadBunnyVideoBinary,
  deleteBunnyVideo,
  getBunnyEmbedUrl,
  getBunnyThumbnailUrl,
  isBunnyConfigured,
} from '../services/bunnyStreamService';
import {
  instructorCourseCreateSchema,
  instructorCourseUpdateSchema,
} from '../schemas/courseReviewSchemas';
import { sectionCreateSchema, sectionUpdateSchema, lessonCreateSchema, lessonUpdateSchema } from '../schemas/courseSchemas';

// ============================================================
// INSTRUCTOR STUDIO — Mentor-owned course authoring, the self-service
// counterpart to the admin-only editor in routes/courses.ts. A course
// created here always has instructorId set and enters the Mentor Course QA
// pipeline (DRAFT -> PENDING_REVIEW -> NEEDS_REVISION -> APPROVED ->
// PUBLISHED -> ARCHIVED — see Course.status's schema comment); it is
// invisible to and unmanageable from the admin-authored catalog flow until
// an admin reviews it via routes/adminCourseModeration.ts.
//
// Every route here is scoped to "courses this Mentor owns" — there is no
// path from this file to another instructor's course, and PUBLISHED is
// never a status this file can set directly (see requireEditableOwnedCourse
// below and submit-for-review's own comment).
// ============================================================

const router = Router();
router.use(authenticate, requireApproved, requireRole('Mentor'));

const EDITABLE_STATUSES = ['DRAFT', 'NEEDS_REVISION'] as const;

class InstructorCourseAccessError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Loads a course, verifying both ownership (must belong to the calling
// Mentor) and — unless `anyStatus` is passed (read-only routes) — that it's
// still in an instructor-editable status. This is the one place both of
// the spec's mentor-side guards ("non-mentors cannot create courses" is the
// router.use above; "mentors cannot edit while PENDING_REVIEW" is here) are
// enforced, so every write route below just calls this instead of
// re-deriving the check.
async function requireOwnedCourse(courseId: string, userId: string, opts: { anyStatus?: boolean } = {}) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || course.instructorId !== userId) {
    throw new InstructorCourseAccessError(404, 'Course not found.');
  }
  if (!opts.anyStatus && !EDITABLE_STATUSES.includes(course.status as (typeof EDITABLE_STATUSES)[number])) {
    throw new InstructorCourseAccessError(
      409,
      `This course cannot be edited while it is ${course.status.replace('_', ' ').toLowerCase()}.`
    );
  }
  return course;
}

async function requireOwnedSection(sectionId: string, userId: string) {
  const section = await prisma.courseSection.findUnique({ where: { id: sectionId }, include: { course: true } });
  if (!section || section.course.instructorId !== userId) {
    throw new InstructorCourseAccessError(404, 'Section not found.');
  }
  if (!EDITABLE_STATUSES.includes(section.course.status as (typeof EDITABLE_STATUSES)[number])) {
    throw new InstructorCourseAccessError(
      409,
      `This course cannot be edited while it is ${section.course.status.replace('_', ' ').toLowerCase()}.`
    );
  }
  return section;
}

async function requireOwnedLesson(lessonId: string, userId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { section: { include: { course: true } } },
  });
  if (!lesson || lesson.section.course.instructorId !== userId) {
    throw new InstructorCourseAccessError(404, 'Lesson not found.');
  }
  if (!EDITABLE_STATUSES.includes(lesson.section.course.status as (typeof EDITABLE_STATUSES)[number])) {
    throw new InstructorCourseAccessError(
      409,
      `This course cannot be edited while it is ${lesson.section.course.status.replace('_', ' ').toLowerCase()}.`
    );
  }
  return lesson;
}

function handleAccessError(err: unknown, res: Response) {
  if (err instanceof InstructorCourseAccessError) {
    res.status(err.status).json({ message: err.message });
    return true;
  }
  return false;
}

function lessonWithPlayback(lesson: { bunnyVideoId: string | null }) {
  return {
    embedUrl: lesson.bunnyVideoId ? getBunnyEmbedUrl(lesson.bunnyVideoId) : null,
    thumbnailUrl: lesson.bunnyVideoId ? getBunnyThumbnailUrl(lesson.bunnyVideoId) : null,
  };
}

// ---- Courses ----

router.get('/', async (req: Request, res: Response) => {
  const courses = await prisma.course.findMany({
    where: { instructorId: req.user!.id },
    include: { _count: { select: { sections: true, enrollments: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  res.json({ data: courses });
});

router.post('/', async (req: Request, res: Response) => {
  const result = instructorCourseCreateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const course = await prisma.course.create({
    data: {
      ...result.data,
      instructorId: req.user!.id,
      status: 'DRAFT',
      // The legacy Course.lessons blob is still a required NOT NULL column
      // (see its own schema comment) even though the real curriculum lives
      // in CourseSection/Lesson below — same placeholder-empty-array shape
      // the admin editor's create form has always sent for a brand-new
      // course with no lessons authored yet.
      lessons: [],
    },
  });
  res.status(201).json({ data: course });
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const course = await requireOwnedCourse(req.params.id, req.user!.id, { anyStatus: true });
    const sections = await prisma.courseSection.findMany({
      where: { courseId: course.id },
      orderBy: { order: 'asc' },
      include: { lessons: { orderBy: { order: 'asc' } } },
    });
    const reviewHistory = await prisma.courseReviewHistory.findMany({
      where: { courseId: course.id },
      orderBy: { createdAt: 'desc' },
      include: { actedBy: { select: { id: true, name: true } } },
    });
    res.json({
      data: {
        ...course,
        sections: sections.map((section) => ({
          ...section,
          lessons: section.lessons.map((lesson) => ({ ...lesson, ...lessonWithPlayback(lesson) })),
        })),
        reviewHistory,
      },
    });
  } catch (err) {
    if (!handleAccessError(err, res)) throw err;
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  const result = instructorCourseUpdateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  try {
    await requireOwnedCourse(req.params.id, req.user!.id);
    const course = await prisma.course.update({ where: { id: req.params.id }, data: result.data });
    res.json({ data: course });
  } catch (err) {
    if (!handleAccessError(err, res)) throw err;
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const course = await requireOwnedCourse(req.params.id, req.user!.id, { anyStatus: true });
    if (course.status !== 'DRAFT') {
      return res.status(409).json({ message: 'Only a course still in Draft can be deleted. Archive it instead.' });
    }
    await prisma.course.delete({ where: { id: course.id } });
    res.status(204).send();
  } catch (err) {
    if (!handleAccessError(err, res)) throw err;
  }
});

// ---- Minimum-quality submit-for-review gate ----

interface QualityCheck {
  key: string;
  met: boolean;
  message: string;
}

async function evaluateQuality(courseId: string): Promise<QualityCheck[]> {
  const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
  const sections = await prisma.courseSection.findMany({ where: { courseId }, include: { lessons: true } });
  const hasSectionWithLesson = sections.some((s) => s.lessons.length > 0);
  const hasLessonWithVideo = sections.some((s) => s.lessons.some((l) => !!l.bunnyVideoId));

  return [
    { key: 'title', met: course.title.trim().length >= 3, message: 'Course title is required.' },
    { key: 'description', met: course.description.trim().length >= 20, message: 'Course description is required (at least 20 characters).' },
    { key: 'coverImage', met: !!course.coverImageUrl, message: 'A cover image must be uploaded.' },
    { key: 'introVideo', met: !!course.introVideoUrl, message: 'A promo/intro video is required.' },
    { key: 'curriculum', met: hasSectionWithLesson, message: 'At least one section with one lesson is required.' },
    { key: 'lessonVideo', met: hasLessonWithVideo, message: 'At least one lesson must have a video uploaded.' },
  ];
}

// Read-only check the frontend polls to decide whether "Submit for Review"
// is enabled — same checklist submit-for-review itself enforces, exposed
// separately so the Instructor Studio UI can show a live checklist instead
// of only finding out what's missing after a failed submit attempt.
router.get('/:id/quality-check', async (req: Request, res: Response) => {
  try {
    await requireOwnedCourse(req.params.id, req.user!.id, { anyStatus: true });
    const checks = await evaluateQuality(req.params.id);
    res.json({ data: { checks, ready: checks.every((c) => c.met) } });
  } catch (err) {
    if (!handleAccessError(err, res)) throw err;
  }
});

router.post('/:id/submit-for-review', async (req: Request, res: Response) => {
  try {
    const course = await requireOwnedCourse(req.params.id, req.user!.id);
    const checks = await evaluateQuality(course.id);
    const unmet = checks.filter((c) => !c.met);
    if (unmet.length > 0) {
      return res.status(400).json({ message: 'This course does not yet meet the minimum quality requirements.', checks: unmet });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.course.update({ where: { id: course.id }, data: { status: 'PENDING_REVIEW' } });
      await tx.courseReviewHistory.create({
        data: {
          courseId: course.id,
          action: 'SUBMITTED',
          fromStatus: course.status,
          toStatus: 'PENDING_REVIEW',
          actedById: req.user!.id,
        },
      });
      return result;
    });
    res.json({ data: updated });
  } catch (err) {
    if (!handleAccessError(err, res)) throw err;
  }
});

// ---- Media uploads (own courses only, editable statuses only) ----

const imageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image uploads are allowed.'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB, same limit as the admin editor's thumbnailUpload
});

function handleImageUploadMiddleware(req: Request, res: Response, next: NextFunction) {
  imageUpload.single('image')(req, res, (err: any) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'The image exceeds 10MB. Please choose a smaller file.' });
    }
    return res.status(400).json({ message: err.message || 'Only image uploads are allowed.' });
  });
}

router.post('/:id/thumbnail', handleImageUploadMiddleware, async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ message: 'No image file was provided.' });
  try {
    const course = await requireOwnedCourse(req.params.id, req.user!.id);
    const filename = `course-${course.id}-${Date.now()}${path.extname(req.file.originalname)}`;
    const url = await uploadImage({ buffer: req.file.buffer, mimetype: req.file.mimetype, filename, folderName: 'course-thumbnails' });
    const updated = await prisma.course.update({ where: { id: course.id }, data: { thumbnailUrl: url } });
    res.json({ data: updated });
  } catch (err) {
    if (!handleAccessError(err, res)) throw err;
  }
});

router.post('/:id/cover-image', handleImageUploadMiddleware, async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ message: 'No image file was provided.' });
  try {
    const course = await requireOwnedCourse(req.params.id, req.user!.id);
    const filename = `course-${course.id}-${Date.now()}${path.extname(req.file.originalname)}`;
    const url = await uploadImage({ buffer: req.file.buffer, mimetype: req.file.mimetype, filename, folderName: 'course-covers' });
    const updated = await prisma.course.update({ where: { id: course.id }, data: { coverImageUrl: url } });
    res.json({ data: updated });
  } catch (err) {
    if (!handleAccessError(err, res)) throw err;
  }
});

// ---- Sections & lessons ----

router.post('/:courseId/sections', async (req: Request, res: Response) => {
  const result = sectionCreateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  try {
    const course = await requireOwnedCourse(req.params.courseId, req.user!.id);
    const section = await prisma.courseSection.create({ data: { ...result.data, courseId: course.id } });
    res.status(201).json({ data: section });
  } catch (err) {
    if (!handleAccessError(err, res)) throw err;
  }
});

router.put('/sections/:sectionId', async (req: Request, res: Response) => {
  const result = sectionUpdateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  try {
    await requireOwnedSection(req.params.sectionId, req.user!.id);
    const section = await prisma.courseSection.update({ where: { id: req.params.sectionId }, data: result.data });
    res.json({ data: section });
  } catch (err) {
    if (!handleAccessError(err, res)) throw err;
  }
});

router.delete('/sections/:sectionId', async (req: Request, res: Response) => {
  try {
    await requireOwnedSection(req.params.sectionId, req.user!.id);
    await prisma.courseSection.delete({ where: { id: req.params.sectionId } });
    res.status(204).send();
  } catch (err) {
    if (!handleAccessError(err, res)) throw err;
  }
});

router.post('/sections/:sectionId/lessons', async (req: Request, res: Response) => {
  const result = lessonCreateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  try {
    const section = await requireOwnedSection(req.params.sectionId, req.user!.id);
    const lesson = await prisma.lesson.create({ data: { ...result.data, sectionId: section.id } });
    res.status(201).json({ data: { ...lesson, ...lessonWithPlayback(lesson) } });
  } catch (err) {
    if (!handleAccessError(err, res)) throw err;
  }
});

router.put('/lessons/:lessonId', async (req: Request, res: Response) => {
  const result = lessonUpdateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  try {
    await requireOwnedLesson(req.params.lessonId, req.user!.id);
    // Mirrors admin routes/courses.ts's own PUT /lessons/:lessonId — a
    // Mentor sets bunnyVideoId only as the manual-fallback text input, same
    // as the admin editor; the primary path is the upload route below.
    const { bunnyVideoId, ...rest } = result.data;
    const lesson = await prisma.lesson.update({
      where: { id: req.params.lessonId },
      data: { ...rest, ...(bunnyVideoId !== undefined ? { bunnyVideoId } : {}) },
    });
    res.json({ data: { ...lesson, ...lessonWithPlayback(lesson) } });
  } catch (err) {
    if (!handleAccessError(err, res)) throw err;
  }
});

router.delete('/lessons/:lessonId', async (req: Request, res: Response) => {
  try {
    const lesson = await requireOwnedLesson(req.params.lessonId, req.user!.id);
    if (lesson.bunnyVideoId) {
      await deleteBunnyVideo(lesson.bunnyVideoId).catch(() => {});
    }
    await prisma.lesson.delete({ where: { id: lesson.id } });
    res.status(204).send();
  } catch (err) {
    if (!handleAccessError(err, res)) throw err;
  }
});

const videoUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('Only video files are allowed.'));
  },
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB, same limit as the admin editor's videoUpload
});

router.post(
  '/lessons/:lessonId/video',
  (req: Request, res: Response, next: NextFunction) => {
    if (!isBunnyConfigured()) {
      return res.status(501).json({ message: 'Bunny Stream is not configured (BUNNY_STREAM_API_KEY / BUNNY_STREAM_LIBRARY_ID).' });
    }
    next();
  },
  (req: Request, res: Response, next: NextFunction) => {
    videoUpload.single('video')(req, res, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'The video exceeds the 2GB limit.' });
      }
      return res.status(400).json({ message: err.message || 'Only video files are allowed.' });
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No video file was provided.' });
    try {
      const lesson = await requireOwnedLesson(req.params.lessonId, req.user!.id);
      if (lesson.bunnyVideoId) {
        await deleteBunnyVideo(lesson.bunnyVideoId).catch(() => {});
      }
      const videoId = await createBunnyVideo(lesson.title);
      await uploadBunnyVideoBinary(videoId, req.file.buffer);
      const updated = await prisma.lesson.update({ where: { id: lesson.id }, data: { bunnyVideoId: videoId } });
      res.status(201).json({ data: { ...updated, ...lessonWithPlayback(updated) } });
    } catch (err) {
      if (handleAccessError(err, res)) return;
      const message = err instanceof Error ? `Video upload to Bunny Stream failed: ${err.message}` : 'Video upload to Bunny Stream failed. Please try again.';
      res.status(502).json({ message });
    }
  }
);

export default router;
