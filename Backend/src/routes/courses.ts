import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import {
  courseCreateSchema,
  courseUpdateSchema,
  sectionCreateSchema,
  sectionUpdateSchema,
  lessonCreateSchema,
  lessonUpdateSchema,
  lessonProgressUpdateSchema,
} from '../schemas/courseSchemas';
import {
  createBunnyVideo,
  uploadBunnyVideoBinary,
  deleteBunnyVideo,
  getBunnyEmbedUrl,
  getBunnyThumbnailUrl,
  isBunnyConfigured,
} from '../services/bunnyStreamService';
import { generateCertificatePdf, generateVerificationCode, CertificateTemplateMissingError } from '../services/certificateService';

const router = Router();

router.get('/', async (req, res) => {
  const courses = await prisma.course.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ data: courses });
});

router.get('/:id', async (req, res) => {
  const course = await prisma.course.findUnique({ where: { id: req.params.id } });
  if (!course) {
    return res.status(404).json({ message: 'Course not found.' });
  }
  res.json({ data: course });
});

router.post('/', authenticate, requireAdminRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const result = courseCreateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  const course = await prisma.course.create({ data: result.data });
  res.status(201).json({ data: course });
});

router.put('/:id', authenticate, requireAdminRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const result = courseUpdateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  try {
    const course = await prisma.course.update({ where: { id: req.params.id }, data: result.data });
    res.json({ data: course });
  } catch (err: any) {
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Course not found.' });
    }
    throw err;
  }
});

router.delete('/:id', authenticate, requireAdminRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    await prisma.course.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Course not found.' });
    }
    throw err;
  }
});

// ============================================================
// LMS — relational curriculum (sections/lessons), progress, certificates.
// ============================================================

declare global {
  namespace Express {
    interface Request {
      isAdminTeamMember?: boolean;
    }
  }
}

// Enrolled students OR any admin-team member (for authoring/preview) may
// access a course's curriculum/progress/certificate. Attaches req.isAdminTeamMember
// so handlers can tell the two apart (e.g. certificates only make sense for
// students who actually completed the course).
async function requireCourseAccess(req: Request, res: Response, next: NextFunction) {
  const courseId = req.params.id ?? req.params.courseId;
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return res.status(404).json({ message: 'Course not found.' });

  const admin = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { adminRole: true } });
  if (admin?.adminRole) {
    req.isAdminTeamMember = true;
    return next();
  }

  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { userId_courseId: { userId: req.user!.id, courseId } },
  });
  if (!enrollment) {
    return res.status(403).json({ message: 'You are not enrolled in this course.' });
  }
  req.isAdminTeamMember = false;
  next();
}

function lessonWithPlayback(lesson: { bunnyVideoId: string | null }) {
  return {
    embedUrl: lesson.bunnyVideoId ? getBunnyEmbedUrl(lesson.bunnyVideoId) : null,
    thumbnailUrl: lesson.bunnyVideoId ? getBunnyThumbnailUrl(lesson.bunnyVideoId) : null,
  };
}

// Curriculum for the /learn player — sections + lessons in order, with the
// current user's per-lesson completion merged in.
router.get('/:id/curriculum', authenticate, requireCourseAccess, async (req: Request, res: Response) => {
  const sections = await prisma.courseSection.findMany({
    where: { courseId: req.params.id },
    orderBy: { order: 'asc' },
    include: {
      lessons: {
        orderBy: { order: 'asc' },
        include: { progress: { where: { userId: req.user!.id } } },
      },
    },
  });

  res.json({
    data: sections.map((section) => ({
      id: section.id,
      title: section.title,
      order: section.order,
      lessons: section.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        durationSeconds: lesson.durationSeconds,
        order: lesson.order,
        resources: lesson.resources,
        completed: lesson.progress[0]?.completed ?? false,
        ...lessonWithPlayback(lesson),
      })),
    })),
  });
});

router.get('/:id/progress', authenticate, requireCourseAccess, async (req: Request, res: Response) => {
  const totalLessons = await prisma.lesson.count({ where: { section: { courseId: req.params.id } } });
  const completedLessons = await prisma.lessonProgress.count({
    where: { completed: true, userId: req.user!.id, lesson: { section: { courseId: req.params.id } } },
  });
  const percent = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);
  res.json({ data: { totalLessons, completedLessons, percent } });
});

router.post('/lessons/:lessonId/progress', authenticate, async (req: Request, res: Response) => {
  const result = lessonProgressUpdateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const lesson = await prisma.lesson.findUnique({
    where: { id: req.params.lessonId },
    include: { section: true },
  });
  if (!lesson) return res.status(404).json({ message: 'Lesson not found.' });

  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { userId_courseId: { userId: req.user!.id, courseId: lesson.section.courseId } },
  });
  const admin = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { adminRole: true } });
  if (!enrollment && !admin?.adminRole) {
    return res.status(403).json({ message: 'You are not enrolled in this course.' });
  }

  const progress = await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: req.user!.id, lessonId: lesson.id } },
    update: { completed: result.data.completed, completedAt: result.data.completed ? new Date() : null },
    create: {
      userId: req.user!.id,
      lessonId: lesson.id,
      completed: result.data.completed,
      completedAt: result.data.completed ? new Date() : null,
    },
  });
  res.json({ data: { lessonId: progress.lessonId, completed: progress.completed } });
});

// ---- Certificate ----

router.get('/:id/certificate', authenticate, requireCourseAccess, async (req: Request, res: Response) => {
  const courseId = req.params.id;
  const totalLessons = await prisma.lesson.count({ where: { section: { courseId } } });
  const completedLessons = await prisma.lessonProgress.count({
    where: { completed: true, userId: req.user!.id, lesson: { section: { courseId } } },
  });
  if (totalLessons === 0 || completedLessons < totalLessons) {
    return res.status(400).json({ message: 'Course must be 100% complete to generate a certificate.' });
  }

  const [course, student] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId } }),
    prisma.user.findUnique({ where: { id: req.user!.id }, select: { name: true } }),
  ]);
  if (!course || !student) return res.status(404).json({ message: 'Course not found.' });

  const existing = await prisma.courseCertificate.findUnique({
    where: { userId_courseId: { userId: req.user!.id, courseId } },
  });
  const certificate =
    existing ??
    (await prisma.courseCertificate.create({
      data: {
        userId: req.user!.id,
        courseId,
        verificationCode: generateVerificationCode(new Date()),
      },
    }));

  try {
    const pdfBuffer = await generateCertificatePdf({
      studentName: student.name,
      courseTitle: course.title,
      instructorName: course.mentorName || 'CDC Faculty',
      issueDate: certificate.issuedAt,
      verificationCode: certificate.verificationCode,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${course.title.replace(/[^a-z0-9]+/gi, '-')}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    if (err instanceof CertificateTemplateMissingError) {
      return res.status(503).json({ message: 'Certificate template is not configured yet.' });
    }
    throw err;
  }
});

// ---- Public certificate verification (no auth) — the target of the QR code
// printed on every certificate PDF, see certificateService.ts. Deliberately
// returns only what's needed to confirm authenticity, not the student's
// account details beyond their name. ----

router.get('/verify/:code', async (req: Request, res: Response) => {
  const certificate = await prisma.courseCertificate.findUnique({
    where: { verificationCode: req.params.code },
    include: { user: { select: { name: true } }, course: { select: { title: true, mentorName: true, mentorTitle: true } } },
  });
  if (!certificate) {
    return res.status(404).json({ message: 'No certificate found for this verification code.' });
  }
  res.json({
    data: {
      verificationCode: certificate.verificationCode,
      studentName: certificate.user.name,
      courseTitle: certificate.course.title,
      instructorName: certificate.course.mentorName,
      instructorTitle: certificate.course.mentorTitle,
      issuedAt: certificate.issuedAt,
    },
  });
});

// ---- Admin: sections & lessons ----

router.post('/:courseId/sections', authenticate, requireAdminRole('SUPER_ADMIN', 'ADMIN'), async (req: Request, res: Response) => {
  const result = sectionCreateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const course = await prisma.course.findUnique({ where: { id: req.params.courseId } });
  if (!course) return res.status(404).json({ message: 'Course not found.' });
  const section = await prisma.courseSection.create({ data: { ...result.data, courseId: course.id } });
  res.status(201).json({ data: section });
});

router.put('/sections/:sectionId', authenticate, requireAdminRole('SUPER_ADMIN', 'ADMIN'), async (req: Request, res: Response) => {
  const result = sectionUpdateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  try {
    const section = await prisma.courseSection.update({ where: { id: req.params.sectionId }, data: result.data });
    res.json({ data: section });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Section not found.' });
    throw err;
  }
});

router.delete('/sections/:sectionId', authenticate, requireAdminRole('SUPER_ADMIN', 'ADMIN'), async (req: Request, res: Response) => {
  try {
    await prisma.courseSection.delete({ where: { id: req.params.sectionId } });
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Section not found.' });
    throw err;
  }
});

router.post('/sections/:sectionId/lessons', authenticate, requireAdminRole('SUPER_ADMIN', 'ADMIN'), async (req: Request, res: Response) => {
  const result = lessonCreateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const section = await prisma.courseSection.findUnique({ where: { id: req.params.sectionId } });
  if (!section) return res.status(404).json({ message: 'Section not found.' });
  const lesson = await prisma.lesson.create({ data: { ...result.data, sectionId: section.id } });
  res.status(201).json({ data: { ...lesson, ...lessonWithPlayback(lesson) } });
});

router.put('/lessons/:lessonId', authenticate, requireAdminRole('SUPER_ADMIN', 'ADMIN'), async (req: Request, res: Response) => {
  const result = lessonUpdateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  try {
    const lesson = await prisma.lesson.update({ where: { id: req.params.lessonId }, data: result.data });
    res.json({ data: { ...lesson, ...lessonWithPlayback(lesson) } });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Lesson not found.' });
    throw err;
  }
});

router.delete('/lessons/:lessonId', authenticate, requireAdminRole('SUPER_ADMIN', 'ADMIN'), async (req: Request, res: Response) => {
  const lesson = await prisma.lesson.findUnique({ where: { id: req.params.lessonId } });
  if (!lesson) return res.status(404).json({ message: 'Lesson not found.' });
  if (lesson.bunnyVideoId) {
    await deleteBunnyVideo(lesson.bunnyVideoId).catch(() => {});
  }
  await prisma.lesson.delete({ where: { id: lesson.id } });
  res.status(204).send();
});

// Admin: full curriculum (bypasses enrollment — admin-team gate only), for
// the /admin/courses editor to list/manage sections+lessons.
router.get('/:courseId/curriculum/admin', authenticate, requireAdminRole('SUPER_ADMIN', 'ADMIN'), async (req: Request, res: Response) => {
  const sections = await prisma.courseSection.findMany({
    where: { courseId: req.params.courseId },
    orderBy: { order: 'asc' },
    include: { lessons: { orderBy: { order: 'asc' } } },
  });
  res.json({
    data: sections.map((section) => ({
      ...section,
      lessons: section.lessons.map((lesson) => ({ ...lesson, ...lessonWithPlayback(lesson) })),
    })),
  });
});

// ---- Admin: direct-from-browser video upload for a lesson ----

const videoUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('Only video files are allowed.'));
  },
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB — course lessons run much longer than gig/forum attachments
});

router.post(
  '/lessons/:lessonId/video',
  authenticate,
  requireAdminRole('SUPER_ADMIN', 'ADMIN'),
  (req: Request, res: Response, next: NextFunction) => {
    if (!isBunnyConfigured()) {
      return res.status(501).json({ message: 'Bunny Stream is not configured (BUNNY_STREAM_API_KEY / BUNNY_STREAM_LIBRARY_ID).' });
    }
    next();
  },
  videoUpload.single('video'),
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No video file was provided.' });
    const lesson = await prisma.lesson.findUnique({ where: { id: req.params.lessonId } });
    if (!lesson) return res.status(404).json({ message: 'Lesson not found.' });

    if (lesson.bunnyVideoId) {
      await deleteBunnyVideo(lesson.bunnyVideoId).catch(() => {});
    }

    try {
      const videoId = await createBunnyVideo(lesson.title);
      await uploadBunnyVideoBinary(videoId, req.file.buffer);
      const updated = await prisma.lesson.update({ where: { id: lesson.id }, data: { bunnyVideoId: videoId } });
      res.status(201).json({ data: { ...updated, ...lessonWithPlayback(updated) } });
    } catch (err) {
      res.status(502).json({ message: 'Video upload to Bunny Stream failed. Please try again.' });
    }
  }
);

export default router;
