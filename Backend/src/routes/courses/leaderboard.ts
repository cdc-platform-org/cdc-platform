/**
 * Public per-course leaderboard (XP from completed lessons and approved assignments).
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

const router = Router();

// ============================================================
// LEADERBOARD — public (the course detail page that shows it,
// /courses/[id], has no auth gate). Names/avatars are already public
// elsewhere on this platform (GET /reviews/user/:userId has no auth
// requirement either), so this isn't a new exposure — but only students
// who've actually made progress are included, not every enrolled student,
// so simply enrolling-and-never-starting is never shown publicly.
//
// XP has no stored column — computed fresh from LessonProgress/
// AssignmentSubmission on every request, the same "derive at read time"
// posture as coursePricing.ts's getCurrentPrice(). AssignmentSubmission has
// no numeric grade field (status is PENDING/APPROVED/NEEDS_REVISION), so
// "assignment grades" means an APPROVED submission counting as a flat XP
// bonus, not a weighted score.
// ============================================================
const XP_PER_COMPLETED_LESSON = 10;
const XP_PER_APPROVED_ASSIGNMENT = 25;

router.get('/:id/leaderboard', async (req: Request, res: Response) => {
  const course = await prisma.course.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!course) return res.status(404).json({ message: 'Course not found.' });

  const enrolledCount = await prisma.courseEnrollment.count({ where: { courseId: course.id } });

  const lessons = await prisma.lesson.findMany({ where: { section: { courseId: course.id } }, select: { id: true } });
  const lessonIds = lessons.map((l) => l.id);
  if (lessonIds.length === 0) {
    return res.json({ data: { enrolledCount, totalLessons: 0, topStudents: [] } });
  }

  const [completedCounts, approvedCounts] = await Promise.all([
    prisma.lessonProgress.groupBy({
      by: ['userId'],
      where: { lessonId: { in: lessonIds }, completed: true },
      _count: { lessonId: true },
    }),
    prisma.assignmentSubmission.groupBy({
      by: ['userId'],
      where: { lessonId: { in: lessonIds }, status: 'APPROVED' },
      _count: { lessonId: true },
    }),
  ]);

  const completedMap = new Map(completedCounts.map((c) => [c.userId, c._count.lessonId]));
  const approvedMap = new Map(approvedCounts.map((c) => [c.userId, c._count.lessonId]));
  const activeUserIds = [...new Set([...completedMap.keys(), ...approvedMap.keys()])];

  const enrollments = await prisma.courseEnrollment.findMany({
    where: { courseId: course.id, userId: { in: activeUserIds } },
    select: { userId: true },
  });
  const enrolledActiveIds = new Set(enrollments.map((e) => e.userId));

  const ranked = activeUserIds
    .filter((userId) => enrolledActiveIds.has(userId))
    .map((userId) => {
      const completedLessons = completedMap.get(userId) ?? 0;
      const approvedAssignments = approvedMap.get(userId) ?? 0;
      return {
        userId,
        completedLessons,
        xp: completedLessons * XP_PER_COMPLETED_LESSON + approvedAssignments * XP_PER_APPROVED_ASSIGNMENT,
      };
    })
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 10);

  const users = await prisma.user.findMany({
    where: { id: { in: ranked.map((r) => r.userId) } },
    select: { id: true, name: true, avatarUrl: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const topStudents = ranked.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    name: userMap.get(r.userId)?.name ?? 'Student',
    avatarUrl: userMap.get(r.userId)?.avatarUrl ?? null,
    completedLessons: r.completedLessons,
    completionPercent: Math.round((r.completedLessons / lessonIds.length) * 100),
    xp: r.xp,
  }));

  res.json({ data: { enrolledCount, totalLessons: lessonIds.length, topStudents } });
});

export default router;
