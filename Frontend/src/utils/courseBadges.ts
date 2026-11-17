/**
 * "Bestseller" badge for course cards, computed from real data only: the
 * course with the most enrollments in the given list (and at least one).
 * "New" and "-X%" come from useCourseDisplayPrice (createdAt / sale state).
 */
import type { Course } from '../types/lms';

export function bestsellerId(courses: Course[]): string | null {
  const top = courses.reduce<Course | null>((best, c) => ((c.enrolledCount ?? 0) > (best?.enrolledCount ?? 0) ? c : best), null);
  return top && (top.enrolledCount ?? 0) > 0 ? top.id : null;
}
