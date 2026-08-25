import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import RoleGate from '../../../src/components/auth/RoleGate';
import SiteHeader from '../../../src/components/layout/SiteHeader';
import SiteFooter from '../../../src/components/layout/SiteFooter';
import BackButton from '../../../src/components/common/BackButton';
import { getMyInstructorCourses, createInstructorCourse } from '../../../src/services/instructorCourseService';
import { InstructorCourse, CourseStatus } from '../../../src/types/instructor';

const STATUS_BADGE: Record<CourseStatus, string> = {
  DRAFT: 'text-slate-600 bg-slate-100 border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700',
  PENDING_REVIEW: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/30',
  NEEDS_REVISION: 'text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-500/10 dark:border-orange-500/30',
  APPROVED: 'text-cyan-700 bg-cyan-50 border-cyan-200 dark:text-cyan-400 dark:bg-cyan-500/10 dark:border-cyan-500/30',
  PUBLISHED: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/30',
  REJECTED: 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-500/10 dark:border-red-500/30',
  ARCHIVED: 'text-slate-600 bg-slate-100 border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700',
};

function NewCourseForm({ onCreated }: { onCreated: (course: InstructorCourse) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 px-5 py-2.5 text-sm font-bold text-white transition-opacity border-none cursor-pointer"
      >
        + New Course
      </button>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceInt = Math.round(parseFloat(price || '0') * 100);
    if (title.trim().length < 3 || description.trim().length < 20 || category.trim().length < 2 || !priceInt) return;
    setSubmitting(true);
    setError(null);
    try {
      const course = await createInstructorCourse({ title: title.trim(), description: description.trim(), category: category.trim(), originalPrice: priceInt });
      onCreated(course);
    } catch {
      setError('Could not create the course. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 bg-white dark:bg-slate-900">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Course title"
        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        placeholder="Description (at least 20 characters)"
        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category (e.g. Web Development)"
          className="rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Price (GEL)"
          className="rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 border-none cursor-pointer"
        >
          {submitting ? 'Creating…' : 'Create Draft'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 bg-transparent border-none cursor-pointer">
          Cancel
        </button>
      </div>
    </form>
  );
}

function InstructorStudioContent() {
  const router = useRouter();
  const [courses, setCourses] = useState<InstructorCourse[] | null>(null);

  const load = useCallback(async () => {
    setCourses(await getMyInstructorCourses());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-12">
        <BackButton fallbackHref="/dashboard/mentorship" className="mb-4 text-slate-400 hover:text-slate-100" />
        <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
          <div>
            <h1 className="text-2xl font-black mb-1">Instructor Studio</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Create and manage your own video courses.</p>
          </div>
          <NewCourseForm onCreated={(course) => router.push(`/dashboard/instructor-studio/${course.id}`)} />
        </div>

        {courses === null ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        ) : courses.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">You haven&apos;t created any courses yet.</p>
        ) : (
          <div className="space-y-3">
            {courses.map((course) => (
              <Link
                key={course.id}
                href={`/dashboard/instructor-studio/${course.id}`}
                className="block rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:border-indigo-300 dark:hover:border-indigo-500/50 no-underline"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{course.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {course.category} · {course._count?.sections ?? 0} section{(course._count?.sections ?? 0) === 1 ? '' : 's'} ·{' '}
                      {course._count?.enrollments ?? 0} student{(course._count?.enrollments ?? 0) === 1 ? '' : 's'}
                    </p>
                  </div>
                  <span className={`text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${STATUS_BADGE[course.status]}`}>
                    {course.status.replace('_', ' ')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

export default function InstructorStudioPage() {
  return (
    <ProtectedRoute>
      <RoleGate
        allowedRoles={['Mentor']}
        fallback={
          <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
            <p className="text-sm text-slate-500">This page is available only to verified Mentors.</p>
            <Link
              href="/dashboard/become-mentor"
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 px-5 py-2.5 text-sm font-bold text-white no-underline"
            >
              Become a Mentor to Publish Courses →
            </Link>
          </div>
        }
      >
        <InstructorStudioContent />
      </RoleGate>
    </ProtectedRoute>
  );
}
