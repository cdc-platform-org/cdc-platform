import { prisma } from '../../lib/prisma';

/** College access is derived on every request, never copied into a permanent paid flag.
 * A passed final exam is terminal even if a learner later unchecks a lesson.
 * Courses without a configured exam follow the existing all-lessons certificate rule.
 */
export async function hasActiveCollegeAiAccess(userId: string): Promise<boolean> {
  const enrollments = await prisma.courseEnrollment.findMany({
    where: { userId, course: { status: 'PUBLISHED' } },
    select: { course: { select: {
      certificates: { where: { userId }, select: { id: true }, take: 1 },
      exam: { select: { attempts: { where: { userId, passed: true }, select: { id: true }, take: 1 } } },
      sections: { select: { lessons: { select: {
        progress: { where: { userId, completed: true }, select: { id: true }, take: 1 },
      } } } },
    } } },
  });
  return enrollments.some(({ course }) => {
    const lessons = course.sections.flatMap(section => section.lessons);
    if (!lessons.length || course.certificates.length || course.exam?.attempts.length) return false;
    return !!course.exam || lessons.some(lesson => !lesson.progress.length);
  });
}
