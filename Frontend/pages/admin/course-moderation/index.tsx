import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AdminGuard from '../../../src/components/admin/AdminGuard';
import AdminLayout from '../../../src/components/admin/AdminLayout';
import { getModerationQueue } from '../../../src/services/adminCourseModerationService';
import { ModerationCourseRow, CourseStatus } from '../../../src/types/instructor';

import { adminLocale, at } from '../../../src/i18n/admin';
const STATUS_TABS: CourseStatus[] = ['PENDING_REVIEW', 'NEEDS_REVISION', 'PUBLISHED', 'REJECTED', 'ARCHIVED'];
const STATUS_LABEL: Record<CourseStatus, string> = {
  get DRAFT() { return at("Draft"); },
  get PENDING_REVIEW() { return at("Pending Review"); },
  get NEEDS_REVISION() { return at("Needs Revision"); },
  get APPROVED() { return at("Approved"); },
  get PUBLISHED() { return at("Published"); },
  get REJECTED() { return at("Rejected"); },
  get ARCHIVED() { return at("Archived"); },
};

function AdminCourseModerationDashboard() {
  const [status, setStatus] = useState<CourseStatus>('PENDING_REVIEW');
  const [courses, setCourses] = useState<ModerationCourseRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setCourses(await getModerationQueue(status));
    setLoading(false);
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{at("Course Moderation Queue")}</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">{at("Review Mentor-authored courses submitted from the Instructor Studio.")}</p>
      </div>

      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-slate-800 pb-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setStatus(tab)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
              status === tab
                ? 'bg-gray-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            {STATUS_LABEL[tab]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">{at("Loading…")}</p>
      ) : courses.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">{at("Nothing here.")}</p>
      ) : (
        <div className="space-y-3">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/admin/course-moderation/${course.id}`}
              className="block rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:border-indigo-300 dark:hover:border-indigo-500/50 no-underline"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{course.title}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {at("by")} {course.instructor.name} ({course.instructor.email}) · {course.category} · {course._count.sections} {at("section")}
                    {course._count.sections === 1 ? '' : 's'}
                  </p>
                </div>
                <span className="text-xs text-gray-400 dark:text-slate-500">{new Date(course.updatedAt).toLocaleDateString(adminLocale())}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminCourseModerationPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AdminCourseModerationDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
