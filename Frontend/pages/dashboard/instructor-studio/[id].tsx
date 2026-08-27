import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import RoleGate from '../../../src/components/auth/RoleGate';
import SiteHeader from '../../../src/components/layout/SiteHeader';
import SiteFooter from '../../../src/components/layout/SiteFooter';
import BackButton from '../../../src/components/common/BackButton';
import LaunchKitDrawer from '../../../src/components/admin/LaunchKitDrawer';
import {
  getInstructorCourse,
  updateInstructorCourse,
  uploadInstructorCourseThumbnail,
  uploadInstructorCourseCoverImage,
  createInstructorSection,
  deleteInstructorSection,
  createInstructorLesson,
  deleteInstructorLesson,
  uploadInstructorLessonVideo,
  getQualityCheck,
  submitCourseForReview,
} from '../../../src/services/instructorCourseService';
import { InstructorCourseDetail, QualityCheck, CourseStatus } from '../../../src/types/instructor';
import { AdminSection } from '../../../src/types/lms';

const EDITABLE_STATUSES: CourseStatus[] = ['DRAFT', 'NEEDS_REVISION'];

const STATUS_BANNER: Record<CourseStatus, { text: string; className: string }> = {
  DRAFT: { text: 'Draft — not yet submitted for review.', className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' },
  PENDING_REVIEW: {
    text: 'Submitted — awaiting admin review. You cannot edit this course right now.',
    className: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30',
  },
  NEEDS_REVISION: {
    text: 'Changes requested — see the feedback below, fix it, and resubmit.',
    className: 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30',
  },
  APPROVED: { text: 'Approved.', className: 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400' },
  PUBLISHED: { text: '✓ Published — live and purchasable on the platform.', className: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  REJECTED: {
    text: '✕ Rejected — see the admin feedback below. This submission cannot be resubmitted; create a new course to try again.',
    className: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30',
  },
  ARCHIVED: { text: 'Archived — withdrawn from the catalog.', className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' },
};

function SectionEditor({ course, onChanged }: { course: InstructorCourseDetail; onChanged: () => void }) {
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const editable = EDITABLE_STATUSES.includes(course.status);

  const handleAddSection = async () => {
    if (!newSectionTitle.trim()) return;
    await createInstructorSection(course.id, { title: newSectionTitle.trim(), order: course.sections.length });
    setNewSectionTitle('');
    onChanged();
  };

  return (
    <div className="space-y-3">
      {course.sections.map((section) => (
        <SectionCard key={section.id} section={section} editable={editable} onChanged={onChanged} />
      ))}
      {editable && (
        <div className="flex items-center gap-2">
          <input
            value={newSectionTitle}
            onChange={(e) => setNewSectionTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSection()}
            placeholder="New section title"
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={handleAddSection}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3 py-2 text-sm font-semibold text-white border-none cursor-pointer"
          >
            + Add section
          </button>
        </div>
      )}
    </div>
  );
}

function SectionCard({ section, editable, onChanged }: { section: AdminSection; editable: boolean; onChanged: () => void }) {
  const [newLessonTitle, setNewLessonTitle] = useState('');

  const handleAddLesson = async () => {
    if (!newLessonTitle.trim()) return;
    await createInstructorLesson(section.id, { title: newLessonTitle.trim(), order: section.lessons.length });
    setNewLessonTitle('');
    onChanged();
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{section.title}</p>
        {editable && (
          <button
            type="button"
            onClick={async () => {
              if (window.confirm(`Delete section "${section.title}" and all its lessons?`)) {
                await deleteInstructorSection(section.id);
                onChanged();
              }
            }}
            className="text-xs text-red-500 bg-transparent border-none cursor-pointer"
          >
            Delete section
          </button>
        )}
      </div>
      <div className="space-y-2">
        {section.lessons.map((lesson) => (
          <LessonRow key={lesson.id} lesson={lesson} editable={editable} onChanged={onChanged} />
        ))}
      </div>
      {editable && (
        <div className="flex items-center gap-2 mt-3">
          <input
            value={newLessonTitle}
            onChange={(e) => setNewLessonTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddLesson()}
            placeholder="New lesson title"
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button type="button" onClick={handleAddLesson} className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold border-none cursor-pointer">
            + Add lesson
          </button>
        </div>
      )}
    </div>
  );
}

function LessonRow({ lesson, editable, onChanged }: { lesson: AdminSection['lessons'][number]; editable: boolean; onChanged: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);

  const handleVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadPct(0);
    try {
      await uploadInstructorLessonVideo(lesson.id, file, setUploadPct);
      onChanged();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
      <span className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${lesson.bunnyVideoId ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
        {lesson.title}
      </span>
      {editable && (
        <span className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept="video/*" onChange={handleVideoFile} disabled={uploading} className="hidden" id={`video-${lesson.id}`} />
          <label htmlFor={`video-${lesson.id}`} className="text-indigo-600 dark:text-indigo-400 cursor-pointer">
            {uploading ? `Uploading… ${uploadPct}%` : lesson.bunnyVideoId ? 'Replace video' : 'Upload video'}
          </label>
          <button
            type="button"
            onClick={async () => {
              await deleteInstructorLesson(lesson.id);
              onChanged();
            }}
            className="text-red-500 bg-transparent border-none cursor-pointer"
          >
            Delete
          </button>
        </span>
      )}
    </div>
  );
}

function QualityChecklist({ courseId, status, onReadyChange }: { courseId: string; status: CourseStatus; onReadyChange: (ready: boolean) => void }) {
  const [checks, setChecks] = useState<QualityCheck[] | null>(null);

  useEffect(() => {
    getQualityCheck(courseId).then((result) => {
      setChecks(result.checks);
      onReadyChange(result.ready);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, status]);

  if (!checks) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Submission Checklist</p>
      {checks.map((check) => (
        <p key={check.key} className={`text-xs flex items-center gap-2 ${check.met ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
          <span>{check.met ? '✓' : '○'}</span> {check.message}
        </p>
      ))}
    </div>
  );
}

function InstructorCourseEditorContent({ courseId }: { courseId: string }) {
  const [course, setCourse] = useState<InstructorCourseDetail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showLaunchKit, setShowLaunchKit] = useState(false);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    // Reset from whatever the PREVIOUS courseId left behind — the page
    // component is reused across course-id changes (no `key={id}` on the
    // parent), so without this, opening one invalid/not-owned course and
    // then navigating to a valid one left loadError stuck true even after
    // the new course loaded successfully.
    setLoadError(false);
    setCourse(null);
    try {
      setCourse(await getInstructorCourse(courseId));
    } catch {
      // Not found, or not yours — never leaves the page stuck on a silent
      // "Loading…" spinner forever.
      setLoadError(true);
    }
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-sm text-slate-500">This course could not be found.</p>
        <Link href="/dashboard/instructor-studio" className="text-sm font-semibold text-cyan-500 hover:underline">
          ← Back to Instructor Studio
        </Link>
      </div>
    );
  }
  if (!course) return <div className="p-12 text-center text-sm text-slate-500">Loading…</div>;

  const editable = EDITABLE_STATUSES.includes(course.status);

  const handleField = async (field: 'title' | 'description' | 'introVideoUrl', value: string) => {
    await updateInstructorCourse(course.id, { [field]: value });
  };

  const handleSubmitForReview = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitCourseForReview(course.id);
      await load();
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message ?? 'Could not submit for review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <BackButton fallbackHref="/dashboard/instructor-studio" className="text-slate-400 hover:text-slate-100" />

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="blog-heading-safe text-2xl font-black mb-2">{course.title}</h1>
            <div className={`inline-block text-xs font-semibold px-3 py-1.5 rounded-lg ${STATUS_BANNER[course.status].className}`}>
              {STATUS_BANNER[course.status].text}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowLaunchKit(true)}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-purple-600 px-3.5 py-2.5 rounded-lg border-none cursor-pointer hover:opacity-90 shrink-0"
          >
            Generate Sales Launch Kit
          </button>
        </div>

        {showLaunchKit && (
          <LaunchKitDrawer target={{ courseId: course.id }} title={course.title} scope="creator" onClose={() => setShowLaunchKit(false)} />
        )}

        {course.reviewHistory.some((h) => h.feedback) && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Admin Feedback</p>
            {course.reviewHistory
              .filter((h) => h.feedback)
              .map((h) => (
                <div key={h.id} className="text-xs rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                  <p className="text-slate-400">{new Date(h.createdAt).toLocaleString()}</p>
                  <p className="text-slate-700 dark:text-slate-300 mt-1">{h.feedback}</p>
                </div>
              ))}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Title</label>
            <input
              defaultValue={course.title}
              disabled={!editable}
              onBlur={(e) => e.target.value !== course.title && handleField('title', e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Description</label>
            <textarea
              defaultValue={course.description}
              disabled={!editable}
              rows={3}
              onBlur={(e) => e.target.value !== course.description && handleField('description', e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Promo / Intro Video URL</label>
            <input
              defaultValue={course.introVideoUrl ?? ''}
              disabled={!editable}
              placeholder="https://... (YouTube, Vimeo, or direct link)"
              onBlur={(e) => e.target.value !== (course.introVideoUrl ?? '') && handleField('introVideoUrl', e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Thumbnail</label>
              {editable && (
                <>
                  <input
                    ref={thumbInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="thumb-input"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      await uploadInstructorCourseThumbnail(course.id, file);
                      await load();
                    }}
                  />
                  <label htmlFor="thumb-input" className="text-xs font-medium text-indigo-600 dark:text-indigo-400 cursor-pointer">
                    {course.thumbnailUrl ? 'Replace image' : 'Upload image'}
                  </label>
                </>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Cover Image</label>
              {editable && (
                <>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="cover-input"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      await uploadInstructorCourseCoverImage(course.id, file);
                      await load();
                    }}
                  />
                  <label htmlFor="cover-input" className="text-xs font-medium text-indigo-600 dark:text-indigo-400 cursor-pointer">
                    {course.coverImageUrl ? 'Replace image' : 'Upload image'}
                  </label>
                </>
              )}
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Curriculum</p>
          <SectionEditor course={course} onChanged={load} />
        </div>

        {editable && (
          <div className="space-y-3">
            <QualityChecklist courseId={course.id} status={course.status} onReadyChange={setReady} />
            {submitError && <p className="text-xs text-red-500">{submitError}</p>}
            <button
              type="button"
              disabled={!ready || submitting}
              onClick={handleSubmitForReview}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 px-6 py-3.5 text-sm font-bold text-white transition-opacity disabled:opacity-40 border-none cursor-pointer"
            >
              {submitting ? 'Submitting…' : 'Submit for Review'}
            </button>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

export default function InstructorCourseEditorPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : null;
  return (
    <ProtectedRoute>
      <RoleGate allowedRoles={['Mentor']} fallback={<Link href="/dashboard/become-mentor">Become a Mentor →</Link>}>
        {id && <InstructorCourseEditorContent courseId={id} />}
      </RoleGate>
    </ProtectedRoute>
  );
}
