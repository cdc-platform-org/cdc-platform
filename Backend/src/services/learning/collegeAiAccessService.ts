/**
 * Course-linked AI tool access: a student enrolled in a PAID course gets the
 * AI tools listed on that course (Course.aiToolKeys, edited by admins on the
 * course edit page) free while they study. Other AI tools are NOT included —
 * they are bought or trialled like for any other user (see
 * services/marketplace/digitalToolAccessService.ts).
 *
 * Derived live on every request (never copied into a permanent flag), so it
 * switches off by itself when the course ends. A course counts as "still
 * being studied" while ALL of these hold:
 *   - the course is PUBLISHED and paid (originalPrice > 0 — a free course must
 *     not become a free, never-ending AI pass),
 *   - the student has not finished it (no certificate, no passed final exam;
 *     courses without an exam use the "all lessons done" rule),
 *   - fewer than COLLEGE_AI_ACCESS_DAYS have passed since enrollment, so a
 *     course that is never finished still ends.
 */
import { prisma } from '../../lib/prisma';

export const COLLEGE_AI_ACCESS_DAYS = 90;
const DAY_MS = 86_400_000;

export interface CollegeAiAccessStatus {
  active: boolean;
  // Latest end date among the courses currently granting access.
  endsAt: Date | null;
  // True when the student HAD course-based access to this tool that has now
  // ended — the Frontend uses it to explain why the paywall is back.
  ended: boolean;
  // Tool keys currently included by any active course (all tools, not just
  // the one asked about) — the My Tools page shows them as "included".
  includedToolKeys: string[];
}

/**
 * @param toolKey  When given, only courses that list this tool count. When
 *                 omitted, any active paid course counts (used only for the
 *                 admin support view and the "included tools" list).
 */
export async function getCollegeAiAccessStatus(userId: string, toolKey?: string, now = new Date()): Promise<CollegeAiAccessStatus> {
  const enrollments = await prisma.courseEnrollment.findMany({
    where: {
      userId,
      course: { status: 'PUBLISHED', originalPrice: { gt: 0 }, ...(toolKey ? { aiToolKeys: { has: toolKey } } : {}) },
    },
    select: { grantedAt: true, course: { select: {
      aiToolKeys: true,
      certificates: { where: { userId }, select: { id: true }, take: 1 },
      exam: { select: { attempts: { where: { userId, passed: true }, select: { id: true }, take: 1 } } },
      sections: { select: { lessons: { select: {
        progress: { where: { userId, completed: true }, select: { id: true }, take: 1 },
      } } } },
    } } },
  });
  let endsAt: Date | null = null;
  const included = new Set<string>();
  for (const { grantedAt, course } of enrollments) {
    const windowEnd = new Date(grantedAt.getTime() + COLLEGE_AI_ACCESS_DAYS * DAY_MS);
    if (grantedAt > now || windowEnd <= now) continue;
    const lessons = course.sections.flatMap(section => section.lessons);
    // A passed final exam is terminal even if a learner later unchecks a lesson.
    if (!lessons.length || course.certificates.length || course.exam?.attempts.length) continue;
    const unfinished = !!course.exam || lessons.some(lesson => !lesson.progress.length);
    if (!unfinished) continue;
    (course.aiToolKeys ?? []).forEach(key => included.add(key));
    if (!endsAt || windowEnd > endsAt) endsAt = windowEnd;
  }
  return { active: !!endsAt, endsAt, ended: !endsAt && enrollments.length > 0, includedToolKeys: [...included] };
}

/** True when an active paid course of this student includes `toolKey`. */
export async function hasCourseToolAccess(userId: string, toolKey: string): Promise<boolean> {
  return (await getCollegeAiAccessStatus(userId, toolKey)).active;
}
