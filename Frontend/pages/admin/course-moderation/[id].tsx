import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import AdminGuard from '../../../src/components/admin/AdminGuard';
import AdminLayout from '../../../src/components/admin/AdminLayout';
import CourseVideoPlayer from '../../../src/components/courses/CourseVideoPlayer';
import VideoEmbed from '../../../src/components/shared/VideoEmbed';
import {
  getModerationCourseDetail,
  approveAndPublishCourse,
  requestCourseRevision,
  rejectCourseSubmission,
} from '../../../src/services/adminCourseModerationService';
import { InstructorCourseDetail, ModerationCourseRow } from '../../../src/types/instructor';

type Detail = InstructorCourseDetail & { instructor: ModerationCourseRow['instructor'] };

function AdminCourseReviewDashboard({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [course, setCourse] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [revisionFeedback, setRevisionFeedback] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setCourse(await getModerationCourseDetail(courseId));
    setLoading(false);
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !course) {
    return <div className="p-6 text-sm text-gray-500 dark:text-slate-400">Loading…</div>;
  }

  const canModerate = course.status === 'PENDING_REVIEW';

  const handleApprove = async () => {
    if (!window.confirm(`Publish "${course.title}"? It becomes purchasable immediately.`)) return;
    setActing(true);
    try {
      await approveAndPublishCourse(course.id);
      router.push('/admin/course-moderation');
    } finally {
      setActing(false);
    }
  };

  const handleRequestRevision = async () => {
    if (revisionFeedback.trim().length < 10) return;
    setActing(true);
    try {
      await requestCourseRevision(course.id, revisionFeedback.trim());
      router.push('/admin/course-moderation');
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (rejectReason.trim().length < 10) return;
    if (!window.confirm('Reject this submission? The mentor cannot resubmit this same course afterward.')) return;
    setActing(true);
    try {
      await rejectCourseSubmission(course.id, rejectReason.trim());
      router.push('/admin/course-moderation');
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Link href="/admin/course-moderation" className="text-xs text-gray-500 dark:text-slate-400 no-underline hover:underline">
        ← Back to queue
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{course.title}</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            by {course.instructor.name} ({course.instructor.email}) · {course.category} · {course.originalPrice / 100} GEL
          </p>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/30">
          {course.status.replace('_', ' ')}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {course.coverImageUrl && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">Cover Image</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={course.coverImageUrl} alt="Course cover" className="rounded-xl border border-gray-200 dark:border-slate-800 w-full object-cover max-h-56" />
          </div>
        )}
        {course.introVideoUrl && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">Promo / Intro Video</p>
            <VideoEmbed url={course.introVideoUrl} title="Intro video" />
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">Description</p>
        <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{course.description}</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">
          Curriculum ({course.sections.length} section{course.sections.length === 1 ? '' : 's'})
        </p>
        <div className="space-y-3">
          {course.sections.map((section) => (
            <div key={section.id} className="rounded-xl border border-gray-200 dark:border-slate-800 p-4">
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{section.title}</p>
              <ul className="space-y-1.5">
                {section.lessons.map((lesson) => (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      onClick={() => setActiveLessonId(lesson.id === activeLessonId ? null : lesson.id)}
                      className="text-xs text-left w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 border-none bg-transparent cursor-pointer"
                    >
                      <span className="flex items-center gap-2 text-gray-700 dark:text-slate-300">
                        <span className={`w-1.5 h-1.5 rounded-full ${lesson.bunnyVideoId ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-600'}`} />
                        {lesson.title}
                      </span>
                      {lesson.bunnyVideoId && <span className="text-indigo-600 dark:text-indigo-400">▶ watch</span>}
                    </button>
                    {activeLessonId === lesson.id && lesson.embedUrl && (
                      <div className="mt-2 mb-3">
                        <CourseVideoPlayer embedUrl={lesson.embedUrl} title={lesson.title} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {course.reviewHistory.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">Review History</p>
          <div className="space-y-2">
            {course.reviewHistory.map((entry) => (
              <div key={entry.id} className="text-xs rounded-lg border border-gray-200 dark:border-slate-800 p-3">
                <p className="text-gray-500 dark:text-slate-400">
                  {entry.action.replace('_', ' ')} by {entry.actedBy.name} · {new Date(entry.createdAt).toLocaleString()}
                </p>
                {entry.feedback && <p className="text-gray-700 dark:text-slate-300 mt-1">{entry.feedback}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {canModerate && (
        <div className="border-t border-gray-200 dark:border-slate-800 pt-5 space-y-4">
          <button
            type="button"
            disabled={acting}
            onClick={handleApprove}
            className="w-full text-sm font-semibold px-4 py-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Approve &amp; Publish
          </button>

          <div className="space-y-2">
            <textarea
              value={revisionFeedback}
              onChange={(e) => setRevisionFeedback(e.target.value)}
              rows={2}
              placeholder="Structural/audio/video notes for the mentor (sent back with the course)"
              className="w-full rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              type="button"
              disabled={acting || revisionFeedback.trim().length < 10}
              onClick={handleRequestRevision}
              className="w-full text-sm font-semibold px-4 py-2.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60"
            >
              Request Revision
            </button>
          </div>

          <div className="space-y-2">
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={2}
              placeholder="Administrative rejection reason (terminal — the mentor cannot resubmit this course)"
              className="w-full rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <button
              type="button"
              disabled={acting || rejectReason.trim().length < 10}
              onClick={handleReject}
              className="w-full text-sm font-semibold px-4 py-2.5 rounded-lg border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-60"
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminCourseReviewPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : null;
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>{id && <AdminCourseReviewDashboard courseId={id} />}</AdminLayout>
    </AdminGuard>
  );
}
