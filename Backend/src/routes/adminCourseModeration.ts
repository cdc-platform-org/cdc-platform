import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { courseRequestRevisionSchema, courseRejectSchema } from '../schemas/courseReviewSchemas';
import { logAdminAction } from '../services/auditLogService';
import { getBunnyEmbedUrl, getBunnyThumbnailUrl } from '../services/bunnyStreamService';

// ============================================================
// ADMIN COURSE MODERATION QUEUE — reviews Mentor-authored courses submitted
// via routes/instructorCourses.ts's POST /:id/submit-for-review. Only
// covers instructorId-not-null courses; the pre-existing admin-authored
// catalog (routes/courses.ts) is untouched by this file and keeps managing
// its own `status` directly through the plain course editor.
//
// PUBLISHED is set ONLY from here (approve) or directly by an admin editing
// their own admin-authored course in routes/courses.ts — never by
// instructorCourses.ts, which enforces the spec's "only admins can publish"
// guard by simply never exposing a route that could.
// ============================================================

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

const instructorSelect = { select: { id: true, name: true, email: true, mentorTitle: true } };

class ClaimError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

router.get('/', async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : 'PENDING_REVIEW';
  const courses = await prisma.course.findMany({
    where: { instructorId: { not: null }, status: status as any },
    include: { instructor: instructorSelect, _count: { select: { sections: true } } },
    orderBy: { updatedAt: 'asc' }, // oldest submission first — a real review queue, not a feed
  });
  res.json({ data: courses });
});

router.get('/:id', async (req: Request, res: Response) => {
  const course = await prisma.course.findUnique({
    where: { id: req.params.id },
    include: { instructor: instructorSelect },
  });
  if (!course || !course.instructorId) return res.status(404).json({ message: 'Course not found.' });

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
        lessons: section.lessons.map((lesson) => ({
          ...lesson,
          embedUrl: lesson.bunnyVideoId ? getBunnyEmbedUrl(lesson.bunnyVideoId) : null,
          thumbnailUrl: lesson.bunnyVideoId ? getBunnyThumbnailUrl(lesson.bunnyVideoId) : null,
        })),
      })),
      reviewHistory,
    },
  });
});

// Atomically claims the course for one specific moderation transition —
// same "updateMany with a status guard, count===0 means someone else beat
// you to it" idiom used across this codebase's other resolve-once actions
// (adminPayouts.ts's approve/reject, examProctoring.ts's submit) — two
// admins reviewing the queue at the same time can no longer both resolve
// the same submission with conflicting outcomes.
async function claimTransition(courseId: string, fromStatuses: string[], toStatus: string) {
  const claim = await prisma.course.updateMany({
    where: { id: courseId, status: { in: fromStatuses as any } },
    data: { status: toStatus as any },
  });
  if (claim.count === 0) {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course || !course.instructorId) throw new ClaimError(404, 'Course not found.');
    throw new ClaimError(409, `This course is ${course.status.replace('_', ' ').toLowerCase()}, not awaiting review.`);
  }
  return prisma.course.findUniqueOrThrow({ where: { id: courseId } });
}

router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const before = await prisma.course.findUnique({ where: { id: req.params.id }, select: { status: true } });
    const updated = await claimTransition(req.params.id, ['PENDING_REVIEW', 'APPROVED'], 'PUBLISHED');
    await prisma.courseReviewHistory.create({
      data: {
        courseId: updated.id,
        action: 'APPROVED_PUBLISHED',
        fromStatus: before!.status,
        toStatus: 'PUBLISHED',
        actedById: req.user!.id,
      },
    });
    await logAdminAction({
      action: 'course.moderation.approve',
      targetType: 'Course',
      targetId: updated.id,
      performedById: req.user!.id,
    });
    res.json({ data: updated });
  } catch (err) {
    if (err instanceof ClaimError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

router.post('/:id/request-revision', async (req: Request, res: Response) => {
  const result = courseRequestRevisionSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  try {
    const updated = await claimTransition(req.params.id, ['PENDING_REVIEW'], 'NEEDS_REVISION');
    await prisma.courseReviewHistory.create({
      data: {
        courseId: updated.id,
        action: 'REQUESTED_REVISION',
        feedback: result.data.feedback,
        fromStatus: 'PENDING_REVIEW',
        toStatus: 'NEEDS_REVISION',
        actedById: req.user!.id,
      },
    });
    await logAdminAction({
      action: 'course.moderation.request-revision',
      targetType: 'Course',
      targetId: updated.id,
      performedById: req.user!.id,
      metadata: { feedback: result.data.feedback },
    });
    res.json({ data: updated });
  } catch (err) {
    if (err instanceof ClaimError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

router.post('/:id/reject', async (req: Request, res: Response) => {
  const result = courseRejectSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  try {
    const updated = await claimTransition(req.params.id, ['PENDING_REVIEW'], 'REJECTED');
    await prisma.courseReviewHistory.create({
      data: {
        courseId: updated.id,
        action: 'REJECTED',
        feedback: result.data.reason,
        fromStatus: 'PENDING_REVIEW',
        toStatus: 'REJECTED',
        actedById: req.user!.id,
      },
    });
    await logAdminAction({
      action: 'course.moderation.reject',
      targetType: 'Course',
      targetId: updated.id,
      performedById: req.user!.id,
      metadata: { reason: result.data.reason },
    });
    res.json({ data: updated });
  } catch (err) {
    if (err instanceof ClaimError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

export default router;
