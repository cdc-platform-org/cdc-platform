import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole, requireApproved } from '../middleware/auth';
import { uploadImage, deleteManagedImage } from '../services/imageStorage';
import { BunnyStorageUploadError } from '../services/bunnyStorage';
import {
  courseCreateSchema,
  courseUpdateSchema,
  sectionCreateSchema,
  sectionUpdateSchema,
  lessonCreateSchema,
  lessonUpdateSchema,
  lessonProgressUpdateSchema,
  examSettingsSchema,
  examSubmitSchema,
  submitAssignmentSchema,
  gradeAssignmentSchema,
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
import { withCurrentPrice } from '../services/coursePricing';
import { generateExamQuestions, isAiExamConfigured, AiExamGenerationError, GeneratedQuestion } from '../services/aiExamService';
import { createExamSessionToken, verifyExamSessionToken, ExamSessionError } from '../services/examSessionService';
import { logAdminAction } from '../services/auditLogService';

const router = Router();

// zod validates discountEndDate as an ISO string (or '' / null / undefined
// for "no sale end date") — Prisma's DateTime field needs an actual Date or
// null, never an empty string.
function toPrismaDiscountEndDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (!value) return null;
  return new Date(value);
}

router.get('/', async (req, res) => {
  const courses = await prisma.course.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ data: courses.map(withCurrentPrice) });
});

// Student's own enrolled courses + per-course progress, for the dashboard
// overview/"My Courses" tab. Registered before GET /:id for the same
// route-ordering reason as /gigs/mine.
router.get('/mine', authenticate, async (req: Request, res: Response) => {
  const enrollments = await prisma.courseEnrollment.findMany({
    where: { userId: req.user!.id },
    include: { course: true },
    orderBy: { grantedAt: 'desc' },
  });

  const data = await Promise.all(
    enrollments.map(async (enrollment) => {
      const [totalLessons, completedLessons, certificate] = await Promise.all([
        prisma.lesson.count({ where: { section: { courseId: enrollment.courseId } } }),
        prisma.lessonProgress.count({
          where: { completed: true, userId: req.user!.id, lesson: { section: { courseId: enrollment.courseId } } },
        }),
        prisma.courseCertificate.findUnique({
          where: { userId_courseId: { userId: req.user!.id, courseId: enrollment.courseId } },
        }),
      ]);
      const percent = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);
      return {
        course: withCurrentPrice(enrollment.course),
        progress: { totalLessons, completedLessons, percent },
        hasCertificate: !!certificate,
        grantedAt: enrollment.grantedAt,
        verificationCode: certificate?.verificationCode ?? null,
        certificateIssuedAt: certificate?.issuedAt ?? null,
      };
    })
  );

  res.json({ data });
});

router.get('/:id', async (req, res) => {
  const course = await prisma.course.findUnique({ where: { id: req.params.id } });
  if (!course) {
    return res.status(404).json({ message: 'Course not found.' });
  }
  res.json({ data: withCurrentPrice(course) });
});

// Public curriculum outline (section/lesson titles + durations only — no
// video embed URLs) for the course details page's syllabus preview, so a
// visitor can see what they'd be buying before enrolling. Deliberately
// separate from GET /:id/curriculum (authenticated, requires enrollment,
// includes playable video embeds).
router.get('/:id/syllabus', async (req, res) => {
  const sections = await prisma.courseSection.findMany({
    where: { courseId: req.params.id },
    orderBy: { order: 'asc' },
    include: {
      lessons: {
        orderBy: { order: 'asc' },
        select: { id: true, title: true, durationSeconds: true, isFreePreview: true, bunnyVideoId: true },
      },
    },
  });
  res.json({
    data: sections.map((section) => ({
      id: section.id,
      title: section.title,
      // embedUrl is only ever populated for isFreePreview lessons — this
      // route is public (no `authenticate`), so a non-preview lesson's
      // video must never be reachable through it regardless of bunnyVideoId.
      lessons: section.lessons.map(({ bunnyVideoId, ...lesson }) => ({
        ...lesson,
        embedUrl: lesson.isFreePreview && bunnyVideoId ? getBunnyEmbedUrl(bunnyVideoId) : null,
      })),
    })),
  });
});

router.post('/', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const result = courseCreateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  const course = await prisma.course.create({
    data: { ...result.data, discountEndDate: toPrismaDiscountEndDate(result.data.discountEndDate) },
  });
  res.status(201).json({ data: withCurrentPrice(course) });
});

router.put('/:id', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const result = courseUpdateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  try {
    const course = await prisma.course.update({
      where: { id: req.params.id },
      data: { ...result.data, discountEndDate: toPrismaDiscountEndDate(result.data.discountEndDate) },
    });
    res.json({ data: withCurrentPrice(course) });
  } catch (err: any) {
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Course not found.' });
    }
    throw err;
  }
});

router.delete('/:id', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
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

const thumbnailUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image uploads are allowed.'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.post(
  '/:id/thumbnail',
  authenticate,
  requireAdminRole('SUPER_ADMIN', 'MANAGER'),
  (req: Request, res: Response, next: NextFunction) => {
    thumbnailUpload.single('thumbnail')(req, res, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'The image exceeds 10MB. Please choose a smaller file.' });
      }
      return res.status(400).json({ message: err.message || 'Only image uploads are allowed.' });
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No file was selected.' });
    const course = await prisma.course.findUnique({ where: { id: req.params.id }, select: { thumbnailUrl: true } });
    if (!course) return res.status(404).json({ message: 'Course not found.' });

    const filename = `course-${req.params.id}-${Date.now()}${path.extname(req.file.originalname)}`;
    try {
      const url = await uploadImage({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        folderName: 'course-thumbnails',
        filename,
      });
      const updated = await prisma.course.update({ where: { id: req.params.id }, data: { thumbnailUrl: url } });

      if (course.thumbnailUrl && course.thumbnailUrl !== url) {
        deleteManagedImage(course.thumbnailUrl).catch(() => {});
      }

      res.status(201).json({ data: withCurrentPrice(updated) });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'Thumbnail upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

router.post(
  '/:id/cover-image',
  authenticate,
  requireAdminRole('SUPER_ADMIN', 'MANAGER'),
  (req: Request, res: Response, next: NextFunction) => {
    thumbnailUpload.single('coverImage')(req, res, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'The image exceeds 10MB. Please choose a smaller file.' });
      }
      return res.status(400).json({ message: err.message || 'Only image uploads are allowed.' });
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No file was selected.' });
    const course = await prisma.course.findUnique({ where: { id: req.params.id }, select: { coverImageUrl: true } });
    if (!course) return res.status(404).json({ message: 'Course not found.' });

    const filename = `course-cover-${req.params.id}-${Date.now()}${path.extname(req.file.originalname)}`;
    try {
      const url = await uploadImage({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        folderName: 'course-covers',
        filename,
      });
      const updated = await prisma.course.update({ where: { id: req.params.id }, data: { coverImageUrl: url } });

      if (course.coverImageUrl && course.coverImageUrl !== url) {
        deleteManagedImage(course.coverImageUrl).catch(() => {});
      }

      res.status(201).json({ data: withCurrentPrice(updated) });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'Cover image upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

router.post(
  '/:id/mentor-avatar',
  authenticate,
  requireAdminRole('SUPER_ADMIN', 'MANAGER'),
  (req: Request, res: Response, next: NextFunction) => {
    thumbnailUpload.single('mentorAvatar')(req, res, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'The image exceeds 10MB. Please choose a smaller file.' });
      }
      return res.status(400).json({ message: err.message || 'Only image uploads are allowed.' });
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No file was selected.' });
    const course = await prisma.course.findUnique({ where: { id: req.params.id }, select: { mentorAvatarUrl: true } });
    if (!course) return res.status(404).json({ message: 'Course not found.' });

    const filename = `course-mentor-${req.params.id}-${Date.now()}${path.extname(req.file.originalname)}`;
    try {
      const url = await uploadImage({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        folderName: 'course-mentors',
        filename,
      });
      const updated = await prisma.course.update({ where: { id: req.params.id }, data: { mentorAvatarUrl: url } });

      if (course.mentorAvatarUrl && course.mentorAvatarUrl !== url) {
        deleteManagedImage(course.mentorAvatarUrl).catch(() => {});
      }

      res.status(201).json({ data: withCurrentPrice(updated) });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'Mentor avatar upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

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
        assignmentPrompt: lesson.assignmentPrompt,
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

// ---- AI Exam & Certification Gate ----
// One Exam per course (admin-configured via PUT below). Questions are
// generated fresh on every /exam/start call (never persisted ahead of
// time) and scored server-side via an encrypted, signed session token —
// see services/examSessionService.ts for why a plain JWT isn't enough on
// its own. Courses with an Exam configured require a passed ExamAttempt to
// download a certificate; courses without one keep the old 100%-lessons gate.

const EXAM_MIN_DURATION_MINUTES = 10;

function examDurationMinutes(questionCount: number): number {
  return Math.max(EXAM_MIN_DURATION_MINUTES, Math.ceil(questionCount * 1.5));
}

function toStudentQuestion(q: GeneratedQuestion) {
  return { id: q.id, topic: q.topic, question: q.question, options: q.options };
}

async function getCourseCompletion(courseId: string, userId: string) {
  const totalLessons = await prisma.lesson.count({ where: { section: { courseId } } });
  const completedLessons = await prisma.lessonProgress.count({
    where: { completed: true, userId, lesson: { section: { courseId } } },
  });
  return totalLessons > 0 && completedLessons >= totalLessons;
}

// Find-or-create — repeated calls (a re-download, or the auto-grant on exam
// pass followed later by an explicit download) always return the same
// verificationCode/issuedAt rather than minting a new "unique" certificate
// every time.
async function getOrCreateCertificate(userId: string, courseId: string) {
  const existing = await prisma.courseCertificate.findUnique({ where: { userId_courseId: { userId, courseId } } });
  return (
    existing ??
    (await prisma.courseCertificate.create({
      data: { userId, courseId, verificationCode: generateVerificationCode(new Date()) },
    }))
  );
}

// Admin: view a course's exam settings (null if none configured yet).
router.get('/:id/exam', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const exam = await prisma.exam.findUnique({ where: { courseId: req.params.id } });
  res.json({ data: exam });
});

// Admin: create or update a course's exam settings.
router.put('/:id/exam', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const result = examSettingsSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const course = await prisma.course.findUnique({ where: { id: req.params.id } });
  if (!course) return res.status(404).json({ message: 'Course not found.' });

  const exam = await prisma.exam.upsert({
    where: { courseId: req.params.id },
    update: result.data,
    create: { ...result.data, courseId: req.params.id },
  });
  res.json({ data: exam });
});

// Student: whether an exam exists for this course, whether they can (re)take
// it right now, and their best result so far.
router.get('/:id/exam/status', authenticate, requireCourseAccess, async (req: Request, res: Response) => {
  const courseId = req.params.id;
  const exam = await prisma.exam.findUnique({ where: { courseId } });
  if (!exam) return res.json({ data: { configured: false } });

  const courseComplete = await getCourseCompletion(courseId, req.user!.id);
  const [passedAttempt, lastAttempt] = await Promise.all([
    prisma.examAttempt.findFirst({ where: { userId: req.user!.id, examId: exam.id, passed: true }, orderBy: { completedAt: 'desc' } }),
    prisma.examAttempt.findFirst({ where: { userId: req.user!.id, examId: exam.id }, orderBy: { completedAt: 'desc' } }),
  ]);

  const cooldownEndsAt =
    lastAttempt && !passedAttempt ? new Date(lastAttempt.completedAt.getTime() + exam.cooldownHours * 60 * 60 * 1000) : null;
  const inCooldown = !!cooldownEndsAt && cooldownEndsAt.getTime() > Date.now();

  res.json({
    data: {
      configured: true,
      passingScore: exam.passingScore,
      cooldownHours: exam.cooldownHours,
      questionCount: exam.questionCount,
      courseComplete,
      passed: !!passedAttempt,
      bestScore: passedAttempt?.score ?? lastAttempt?.score ?? null,
      lastAttemptAt: lastAttempt?.completedAt ?? null,
      weakTopics: !passedAttempt ? lastAttempt?.weakTopics ?? [] : [],
      inCooldown,
      cooldownEndsAt,
      canStart: courseComplete && !passedAttempt && !inCooldown,
    },
  });
});

router.post('/:id/exam/start', authenticate, requireCourseAccess, async (req: Request, res: Response) => {
  const courseId = req.params.id;
  if (!isAiExamConfigured()) {
    return res.status(501).json({ message: 'AI exam generation is not configured yet (GEMINI_API_KEY).' });
  }

  const [course, exam] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId } }),
    prisma.exam.findUnique({ where: { courseId } }),
  ]);
  if (!course) return res.status(404).json({ message: 'Course not found.' });
  if (!exam) return res.status(404).json({ message: 'This course does not have a certification exam configured.' });

  if (!(await getCourseCompletion(courseId, req.user!.id))) {
    return res.status(400).json({ message: 'Complete 100% of the course lessons before taking the exam.' });
  }

  const [passedAttempt, lastAttempt] = await Promise.all([
    prisma.examAttempt.findFirst({ where: { userId: req.user!.id, examId: exam.id, passed: true } }),
    prisma.examAttempt.findFirst({ where: { userId: req.user!.id, examId: exam.id }, orderBy: { completedAt: 'desc' } }),
  ]);
  if (passedAttempt) {
    return res.status(400).json({ message: 'You have already passed this exam.' });
  }
  if (lastAttempt) {
    const cooldownEndsAt = new Date(lastAttempt.completedAt.getTime() + exam.cooldownHours * 60 * 60 * 1000);
    if (cooldownEndsAt.getTime() > Date.now()) {
      return res.status(429).json({ message: 'You are on a retake cooldown.', cooldownEndsAt });
    }
  }

  const lessonTitles = (await prisma.lesson.findMany({ where: { section: { courseId } }, select: { title: true } })).map(
    (l) => l.title
  );

  const requestedLang = req.body?.lang === 'ka' ? 'ka' : req.body?.lang === 'en' ? 'en' : undefined;

  let questions: GeneratedQuestion[];
  try {
    questions = await generateExamQuestions({
      courseTitle: course.title,
      courseDescription: course.description,
      lessonTitles,
      questionCount: exam.questionCount,
      aiPromptContext: exam.aiPromptContext,
      focusTopics: lastAttempt?.weakTopics.length ? lastAttempt.weakTopics : undefined,
      lang: requestedLang,
    });
  } catch (err) {
    if (err instanceof AiExamGenerationError) {
      return res.status(502).json({ message: err.message });
    }
    throw err;
  }

  const durationMinutes = examDurationMinutes(exam.questionCount);
  const sessionToken = createExamSessionToken({ userId: req.user!.id, courseId, examId: exam.id, questions, durationMinutes });

  res.json({
    data: { sessionToken, durationMinutes, passingScore: exam.passingScore, questions: questions.map(toStudentQuestion) },
  });
});

router.post('/:id/exam/submit', authenticate, requireCourseAccess, async (req: Request, res: Response) => {
  const courseId = req.params.id;
  const result = examSubmitSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  let session;
  try {
    session = verifyExamSessionToken(result.data.sessionToken);
  } catch (err) {
    return res.status(400).json({ message: err instanceof ExamSessionError ? err.message : 'Invalid exam session.' });
  }
  if (session.userId !== req.user!.id || session.courseId !== courseId) {
    return res.status(400).json({ message: 'This exam session does not belong to you.' });
  }

  const exam = await prisma.exam.findUnique({ where: { id: session.examId } });
  if (!exam || exam.courseId !== courseId) {
    return res.status(404).json({ message: 'Exam not found.' });
  }

  const total = session.questions.length;
  let correctCount = 0;
  const wrongTopics: string[] = [];
  const review = session.questions.map((q) => {
    const selected = result.data.answers[q.id];
    const correct = selected === q.correctAnswer;
    if (correct) correctCount += 1;
    else wrongTopics.push(q.topic);
    return {
      id: q.id,
      topic: q.topic,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      selected: selected ?? null,
      correct,
      explanation: q.explanation,
    };
  });

  const score = total === 0 ? 0 : Math.round((correctCount / total) * 100);
  const passed = score >= exam.passingScore;
  const weakTopics = Array.from(new Set(wrongTopics));

  await prisma.examAttempt.create({
    data: { userId: req.user!.id, examId: exam.id, score, passed, questions: review, weakTopics },
  });

  const cooldownEndsAt = passed ? null : new Date(Date.now() + exam.cooldownHours * 60 * 60 * 1000);

  // Passing a certification exam is the automatic CDC Alumni gate — instantly
  // grants isVerifiedGraduate (unlimited forum posts/applications, the
  // glowing badge, the mentorship button) and mints the certificate record
  // right away, rather than waiting for the student to click "Download".
  let verificationCode: string | null = null;
  if (passed) {
    const certificate = await getOrCreateCertificate(req.user!.id, courseId);
    verificationCode = certificate.verificationCode;

    const student = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { isVerifiedGraduate: true } });
    if (!student?.isVerifiedGraduate) {
      await prisma.user.update({ where: { id: req.user!.id }, data: { isVerifiedGraduate: true } });
      await logAdminAction({
        action: 'user.auto_verify_graduate',
        targetType: 'User',
        targetId: req.user!.id,
        performedById: req.user!.id,
        metadata: { trigger: 'exam_pass', courseId, examId: exam.id, score },
      });
    }
  }

  res.json({
    data: {
      score,
      passed,
      correctCount,
      total,
      passingScore: exam.passingScore,
      weakTopics,
      cooldownEndsAt,
      review,
      certificateIssued: passed,
      verificationCode,
    },
  });
});

// ---- Certificate ----

router.get('/:id/certificate', authenticate, requireCourseAccess, async (req: Request, res: Response) => {
  const courseId = req.params.id;
  const exam = await prisma.exam.findUnique({ where: { courseId } });

  if (exam) {
    const passedAttempt = await prisma.examAttempt.findFirst({ where: { userId: req.user!.id, examId: exam.id, passed: true } });
    if (!passedAttempt) {
      return res.status(400).json({ message: 'You must pass the certification exam to generate a certificate.' });
    }
  } else if (!(await getCourseCompletion(courseId, req.user!.id))) {
    return res.status(400).json({ message: 'Course must be 100% complete to generate a certificate.' });
  }

  const [course, student] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId } }),
    prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { name: true, legalFirstNameKa: true, legalLastNameKa: true, legalFirstNameEn: true, legalLastNameEn: true },
    }),
  ]);
  if (!course || !student) return res.status(404).json({ message: 'Course not found.' });

  // Legal name (if the student has filled it in under /dashboard/settings)
  // takes precedence over the display `name` — certificates need to match
  // the person's real identity. The English transliteration line is only
  // shown when explicitly set; we never guess a transliteration.
  const legalNameKa =
    student.legalFirstNameKa && student.legalLastNameKa ? `${student.legalFirstNameKa} ${student.legalLastNameKa}` : null;
  const legalNameEn =
    student.legalFirstNameEn && student.legalLastNameEn ? `${student.legalFirstNameEn} ${student.legalLastNameEn}` : null;

  const certificate = await getOrCreateCertificate(req.user!.id, courseId);

  try {
    const pdfBuffer = await generateCertificatePdf({
      studentName: legalNameKa || student.name,
      studentNameSecondary: legalNameEn,
      courseTitle: course.title,
      courseTitleEn: course.titleEn,
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
    // Not a real CourseCertificate — fall back to a manually-issued one
    // (retroactive certs for graduates/courses with no User/Course row).
    const manual = await prisma.manualCertificate.findUnique({ where: { verificationCode: req.params.code } });
    if (!manual) {
      return res.status(404).json({ message: 'No certificate found for this verification code.' });
    }
    return res.json({
      data: {
        verificationCode: manual.verificationCode,
        studentName: manual.studentNameEn ? `${manual.studentNameKa} / ${manual.studentNameEn}` : manual.studentNameKa,
        courseTitle: manual.courseTitleEn ? `${manual.courseTitleKa} / ${manual.courseTitleEn}` : manual.courseTitleKa,
        instructorName: manual.instructorName,
        instructorTitle: null,
        issuedAt: manual.issueDate,
      },
    });
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

router.post('/:courseId/sections', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const result = sectionCreateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const course = await prisma.course.findUnique({ where: { id: req.params.courseId } });
  if (!course) return res.status(404).json({ message: 'Course not found.' });
  const section = await prisma.courseSection.create({ data: { ...result.data, courseId: course.id } });
  res.status(201).json({ data: section });
});

router.put('/sections/:sectionId', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
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

router.delete('/sections/:sectionId', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  try {
    await prisma.courseSection.delete({ where: { id: req.params.sectionId } });
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Section not found.' });
    throw err;
  }
});

router.post('/sections/:sectionId/lessons', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const result = lessonCreateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const section = await prisma.courseSection.findUnique({ where: { id: req.params.sectionId } });
  if (!section) return res.status(404).json({ message: 'Section not found.' });
  const lesson = await prisma.lesson.create({ data: { ...result.data, sectionId: section.id } });
  res.status(201).json({ data: { ...lesson, ...lessonWithPlayback(lesson) } });
});

// Pulls a bare Bunny Stream video GUID out of a pasted embed/play URL
// (e.g. "https://iframe.mediadelivery.net/embed/710897/<guid>") — passes
// through unchanged if it's already just the ID.
function extractBunnyVideoId(input: string): string {
  const match = input.match(/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/);
  return match ? match[1] : input.trim();
}

router.put('/lessons/:lessonId', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const result = lessonUpdateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { bunnyVideoId, ...rest } = result.data;
  try {
    const lesson = await prisma.lesson.update({
      where: { id: req.params.lessonId },
      data: { ...rest, ...(bunnyVideoId !== undefined ? { bunnyVideoId: bunnyVideoId ? extractBunnyVideoId(bunnyVideoId) : null } : {}) },
    });
    res.json({ data: { ...lesson, ...lessonWithPlayback(lesson) } });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Lesson not found.' });
    throw err;
  }
});

router.delete('/lessons/:lessonId', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
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
router.get('/:courseId/curriculum/admin', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
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
  requireAdminRole('SUPER_ADMIN', 'MANAGER'),
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
      // Surface Bunny's actual error (invalid credentials, quota, network,
      // etc.) instead of a generic message — this is exactly the kind of
      // failure that's otherwise silent/unclear to whoever's uploading.
      const message = err instanceof Error ? `Video upload to Bunny Stream failed: ${err.message}` : 'Video upload to Bunny Stream failed. Please try again.';
      res.status(502).json({ message });
    }
  }
);

// ============================================================
// HOMEWORK ASSIGNMENTS — one submission per student per lesson (resubmit
// overwrites, see the schema's unique constraint), reviewed by admins.
// ============================================================

// Student: submit/resubmit for a lesson they're enrolled in.
const assignmentFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB — homework files, not lesson videos
});

// Student: upload a homework file, get back a URL to pass as fileUrl in the
// actual POST /submissions call below (kept separate so a slow upload
// doesn't block/duplicate the submission record itself).
router.post(
  '/lessons/:lessonId/submissions/upload',
  authenticate,
  requireApproved,
  (req: Request, res: Response, next: NextFunction) => {
    assignmentFileUpload.single('file')(req, res, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'File is too large (50MB max).' });
      }
      return res.status(400).json({ message: err.message || 'Upload rejected.' });
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No file was selected.' });
    const filename = `submission-${req.user!.id}-${Date.now()}${path.extname(req.file.originalname)}`;
    try {
      const url = await uploadImage({ buffer: req.file.buffer, mimetype: req.file.mimetype, folderName: 'assignment-submissions', filename });
      res.status(201).json({ data: { url } });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'File upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

router.post('/lessons/:lessonId/submissions', authenticate, requireApproved, async (req: Request, res: Response) => {
  const result = submitAssignmentSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const lesson = await prisma.lesson.findUnique({ where: { id: req.params.lessonId }, include: { section: true } });
  if (!lesson) return res.status(404).json({ message: 'Lesson not found.' });

  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { userId_courseId: { userId: req.user!.id, courseId: lesson.section.courseId } },
  });
  if (!enrollment) return res.status(403).json({ message: 'You are not enrolled in this course.' });

  const submission = await prisma.assignmentSubmission.upsert({
    where: { lessonId_userId: { lessonId: lesson.id, userId: req.user!.id } },
    // A resubmission clears any prior grading — it's a new attempt, not an
    // edit of the graded one.
    update: { ...result.data, status: 'PENDING', feedback: null },
    create: { ...result.data, lessonId: lesson.id, userId: req.user!.id },
  });
  res.status(201).json({ data: submission });
});

// Student: their own submission for a lesson (to show status/feedback on
// the player's Assignment tab).
router.get('/lessons/:lessonId/submissions/mine', authenticate, async (req: Request, res: Response) => {
  const submission = await prisma.assignmentSubmission.findUnique({
    where: { lessonId_userId: { lessonId: req.params.lessonId, userId: req.user!.id } },
  });
  res.json({ data: submission });
});

// Admin: every submission across every course, most recent first — the
// review queue backing /admin/assignments.
router.get('/admin/submissions', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const statusFilter = typeof req.query.status === 'string' ? req.query.status : undefined;
  const submissions = await prisma.assignmentSubmission.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true } },
      lesson: { select: { id: true, title: true, section: { select: { title: true, course: { select: { id: true, title: true } } } } } },
    },
  });
  res.json({ data: submissions });
});

router.post('/admin/submissions/:id/grade', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const result = gradeAssignmentSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  try {
    const updated = await prisma.assignmentSubmission.update({
      where: { id: req.params.id },
      data: result.data,
    });
    res.json({ data: updated });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Submission not found.' });
    throw err;
  }
});

export default router;
