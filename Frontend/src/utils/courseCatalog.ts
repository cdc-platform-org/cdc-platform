/**
 * Shared public-catalog rules for courses.
 *
 * Why: the backend moved from a boolean `published` to a `status` enum
 * (migration 2026-08-25) and no longer sends `published` on the public
 * GET /api/courses response — so every `c.published` filter on the
 * frontend silently hid ALL courses (home page, /courses, search, header
 * search). This helper accepts either shape so old and new API responses
 * both work.
 */
import type { Course } from '../types/lms';

export function isPublishedCourse(course: Pick<Course, 'published'> & { status?: string | null }): boolean {
  if (course.status) return course.status === 'PUBLISHED';
  return course.published === true;
}
