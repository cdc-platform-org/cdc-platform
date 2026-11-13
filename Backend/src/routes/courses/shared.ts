/**
 * Helpers shared by the course routers: discount field coercion, capacity
 * info, the course-access rule (enrolled student or admin-team member) and
 * lesson video playback URLs.
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { requireNotBannedOrDeleted } from '../../middleware/auth';
import { getBunnyEmbedUrl, getBunnyThumbnailUrl } from '../../services/bunnyStreamService';

// zod validates discountEndDate as an ISO string (or '' / null / undefined
// for "no sale end date") — Prisma's DateTime field needs an actual Date or
// null, never an empty string.
export function toPrismaDiscountEndDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (!value) return null;
  return new Date(value);
}

// Same "'' from the admin form means unset, not a literal empty string"
// normalization as toPrismaDiscountEndDate above, for the plain-text badge
// override.
export function toPrismaDiscountBadgeText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value || null;
}

// enrolledCount is always the live CourseEnrollment count (via `_count`),
// never a stored counter — same "count on read, can't drift" posture as
// liveTrainings.ts's withCapacity(). Unlike LiveTraining, maxCapacity is
// nullable here (most courses are unlimited), so seatsRemaining/isFull only
// mean something once a cap is actually set.
export function withCapacityInfo<T extends { maxCapacity: number | null; _count: { enrollments: number } }>(course: T) {
  const { _count, ...rest } = course;
  const enrolledCount = _count.enrollments;
  return {
    ...rest,
    enrolledCount,
    seatsRemaining: course.maxCapacity != null ? Math.max(0, course.maxCapacity - enrolledCount) : null,
    isFull: course.maxCapacity != null && enrolledCount >= course.maxCapacity,
  };
}


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
// access a course. Exported so other route files needing the same rule
// (e.g. the AI course tutor in routes/ai.ts, which checks access on a body
// field rather than a URL param and so can't use the middleware directly)
// can reuse this instead of re-implementing the enrollment check.
export async function checkCourseAccess(
  userId: string,
  courseId: string
): Promise<{ allowed: boolean; isAdminTeamMember: boolean }> {
  const admin = await prisma.user.findUnique({ where: { id: userId }, select: { adminRole: true } });
  if (admin?.adminRole) return { allowed: true, isAdminTeamMember: true };

  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  return { allowed: !!enrollment, isAdminTeamMember: false };
}

// Attaches req.isAdminTeamMember so handlers can tell the two apart (e.g.
// certificates only make sense for students who actually completed the
// course).
// AUDIT NOTE (fixed): authenticate() only verifies the JWT itself — it never
// re-checks the account's current standing (see requireNotBannedOrDeleted's
// own comment) — so a student banned or who self-requested deletion AFTER
// their token was issued could keep watching lessons, sitting the
// certification exam, and downloading a certificate for up to 7 more days
// on every route this guards (curriculum, progress, exam status/start/
// submit, certificate, discussion). Wrapping it here fixes every one of
// those call sites in one place instead of threading a second middleware
// through each route registration individually.
export async function requireCourseAccess(req: Request, res: Response, next: NextFunction) {
  await requireNotBannedOrDeleted(req, res, async () => {
    const courseId = req.params.id ?? req.params.courseId;
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ message: 'Course not found.' });

    const { allowed, isAdminTeamMember } = await checkCourseAccess(req.user!.id, courseId);
    if (!allowed) return res.status(403).json({ message: 'You are not enrolled in this course.' });
    req.isAdminTeamMember = isAdminTeamMember;
    next();
  });
}

export function lessonWithPlayback(lesson: { bunnyVideoId: string | null }) {
  return {
    embedUrl: lesson.bunnyVideoId ? getBunnyEmbedUrl(lesson.bunnyVideoId) : null,
    thumbnailUrl: lesson.bunnyVideoId ? getBunnyThumbnailUrl(lesson.bunnyVideoId) : null,
  };
}
