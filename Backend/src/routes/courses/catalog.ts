/**
 * Course catalog and admin course CRUD: public list/detail/syllabus,
 * GET /mine (my enrolled courses with progress), create/update/delete and
 * thumbnail/promo media uploads.
 */
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { prisma } from '../../lib/prisma';
import { authenticate, requireAdminRole } from '../../middleware/auth';
import { uploadImage, deleteManagedImage } from '../../services/imageStorage';
import { BunnyStorageUploadError } from '../../services/bunnyStorage';
import { courseCreateSchema, courseUpdateSchema } from '../../schemas/courseSchemas';
import { getBunnyEmbedUrl } from '../../services/bunnyStreamService';
import { withCurrentPrice, validateCourseDiscount } from '../../services/coursePricing';
import { withCourseRatings } from '../../services/learningRatingService';
import { toPrismaDiscountEndDate, toPrismaDiscountBadgeText, withCapacityInfo } from './shared';

const router = Router();

router.get('/', async (req, res) => {
  const courses = await prisma.course.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { enrollments: true } } },
  });
  res.json({ data: await withCourseRatings(courses.map((c) => withCurrentPrice(withCapacityInfo(c)))) });
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
  const courseIds = enrollments.map((e) => e.courseId);

  // Previously 3 queries PER enrollment (lesson count, completed-lesson
  // count, certificate lookup) — 3N+1 total for a student with N courses.
  // Batched below into 3 queries total regardless of N: one for every
  // lesson id in every enrolled course, one for which of those this user
  // has completed, one for certificates across all of them at once.
  const [sections, certificates] = await Promise.all([
    prisma.courseSection.findMany({
      where: { courseId: { in: courseIds } },
      select: { courseId: true, lessons: { select: { id: true } } },
    }),
    prisma.courseCertificate.findMany({ where: { userId: req.user!.id, courseId: { in: courseIds } } }),
  ]);

  const lessonIdsByCourse = new Map<string, string[]>();
  for (const section of sections) {
    const ids = lessonIdsByCourse.get(section.courseId) ?? [];
    ids.push(...section.lessons.map((l) => l.id));
    lessonIdsByCourse.set(section.courseId, ids);
  }
  const allLessonIds = sections.flatMap((s) => s.lessons.map((l) => l.id));
  const completedProgress = allLessonIds.length
    ? await prisma.lessonProgress.findMany({
        where: { completed: true, userId: req.user!.id, lessonId: { in: allLessonIds } },
        select: { lessonId: true },
      })
    : [];
  const completedLessonIds = new Set(completedProgress.map((p) => p.lessonId));
  const certificateByCourse = new Map(certificates.map((c) => [c.courseId, c]));

  const data = enrollments.map((enrollment) => {
    const lessonIds = lessonIdsByCourse.get(enrollment.courseId) ?? [];
    const totalLessons = lessonIds.length;
    const completedLessons = lessonIds.filter((id) => completedLessonIds.has(id)).length;
    const percent = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);
    const certificate = certificateByCourse.get(enrollment.courseId);
    return {
      course: withCurrentPrice(enrollment.course),
      progress: { totalLessons, completedLessons, percent },
      hasCertificate: !!certificate,
      grantedAt: enrollment.grantedAt,
      verificationCode: certificate?.verificationCode ?? null,
      certificateIssuedAt: certificate?.issuedAt ?? null,
      certificateDownloadCount: certificate?.downloadCount ?? 0,
    };
  });

  res.json({ data });
});

router.get('/:id', async (req, res) => {
  const course = await prisma.course.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { enrollments: true } } },
  });
  if (!course) {
    return res.status(404).json({ message: 'Course not found.' });
  }
  res.json({ data: (await withCourseRatings([withCurrentPrice(withCapacityInfo(course))]))[0] });
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

  const discountError = validateCourseDiscount(result.data.originalPrice, result.data.discountPercent, result.data.isOnSale);
  if (discountError) return res.status(400).json({ message: discountError });

  const course = await prisma.course.create({
    data: {
      ...result.data,
      discountEndDate: toPrismaDiscountEndDate(result.data.discountEndDate),
      discountBadgeText: toPrismaDiscountBadgeText(result.data.discountBadgeText),
    },
  });
  res.status(201).json({ data: withCurrentPrice(course) });
});

router.put('/:id', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const result = courseUpdateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  const existing = await prisma.course.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Course not found.' });

  // A partial update may touch only one of originalPrice/discountPercent/
  // isOnSale — validate against the values the row will actually have once
  // this update lands, not just whatever happened to be in this request body.
  const discountError = validateCourseDiscount(
    result.data.originalPrice ?? existing.originalPrice,
    result.data.discountPercent !== undefined ? result.data.discountPercent : existing.discountPercent,
    result.data.isOnSale ?? existing.isOnSale
  );
  if (discountError) return res.status(400).json({ message: discountError });

  try {
    const course = await prisma.course.update({
      where: { id: req.params.id },
      data: {
        ...result.data,
        discountEndDate: toPrismaDiscountEndDate(result.data.discountEndDate),
        discountBadgeText: toPrismaDiscountBadgeText(result.data.discountBadgeText),
      },
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

export default router;
