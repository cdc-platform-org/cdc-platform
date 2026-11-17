/**
 * "College" AI access: a student enrolled in a PAID course gets every AI tool
 * free while they study. Derived live on every request (never copied into a
 * permanent flag), so it switches off by itself when the course ends.
 *
 * A course counts as "still being studied" while ALL of these hold:
 *   - the course is PUBLISHED and paid (originalPrice > 0 — a free course must
 *     not become a free, never-ending AI pass),
 *   - the student has not finished it (no certificate, no passed final exam;
 *     courses without an exam use the "all lessons done" rule),
 *   - fewer than COLLEGE_AI_ACCESS_DAYS have passed since enrollment, so a
 *     course that is never finished still ends.
 * After that the student keeps the tool only via the monthly AI tool
 * subscription (config/aiToolSubscriptions.ts) or an admin AccessGrant.
 */
import { prisma } from '../../lib/prisma';

export const COLLEGE_AI_ACCESS_DAYS = 90;
const DAY_MS = 86_400_000;

export interface CollegeAiAccessStatus {
  active: boolean;
  // Latest end date among the courses currently granting access.
  endsAt: Date | null;
  // True when the student HAD course-based access that has now ended — the
  // Frontend uses it to show "your course access ended, subscribe monthly".
  ended: boolean;
}

export async function getCollegeAiAccessStatus(userId: string, now = new Date()): Promise<CollegeAiAccessStatus> {
  const enrollments = await prisma.courseEnrollment.findMany({
    where: { userId, course: { status: 'PUBLISHED', originalPrice: { gt: 0 } } },
    select: { grantedAt: true, course: { select: {
      certificates: { where: { userId }, select: { id: true }, take: 1 },
      exam: { select: { attempts: { where: { userId, passed: true }, select: { id: true }, take: 1 } } },
      sections: { select: { lessons: { select: {
        progress: { where: { userId, completed: true }, select: { id: true }, take: 1 },
      } } } },
    } } },
  });
  let endsAt: Date | null = null;
  for (const { grantedAt, course } of enrollments) {
    const windowEnd = new Date(grantedAt.getTime() + COLLEGE_AI_ACCESS_DAYS * DAY_MS);
    if (grantedAt > now || windowEnd <= now) continue;
    const lessons = course.sections.flatMap(section => section.lessons);
    // A passed final exam is terminal even if a learner later unchecks a lesson.
    if (!lessons.length || course.certificates.length || course.exam?.attempts.length) continue;
    const unfinished = !!course.exam || lessons.some(lesson => !lesson.progress.length);
    if (unfinished && (!endsAt || windowEnd > endsAt)) endsAt = windowEnd;
  }
  return { active: !!endsAt, endsAt, ended: !endsAt && enrollments.length > 0 };
}

export async function hasActiveCollegeAiAccess(userId: string): Promise<boolean> {
  return (await getCollegeAiAccessStatus(userId)).active;
}
