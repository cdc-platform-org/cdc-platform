import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { ShieldAlert, Loader2 } from 'lucide-react';
import type { TFunction } from 'next-i18next';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../../src/components/layout/SiteHeader';
import BackButton from '../../../src/components/common/BackButton';
import CourseVideoPlayer from '../../../src/components/courses/CourseVideoPlayer';
import CourseTutorPanel from '../../../src/components/courses/CourseTutorPanel';
import CourseDiscussionPanel from '../../../src/components/shared/CourseDiscussionPanel';
import MarkdownContent from '../../../src/components/shared/MarkdownContent';
import { useAuth } from '../../../src/context/AuthContext';
import { useEscapeToClose } from '../../../src/hooks/useEscapeToClose';
import { LmsSection, LmsLesson, CourseProgressSummary, Course, ExamStatus, AssignmentSubmission } from '../../../src/types/lms';
import {
  getCourse,
  getCurriculum,
  getProgressSummary,
  setLessonProgress,
  downloadCertificate,
  getExamStatus,
  getMySubmission,
  submitAssignment,
  uploadSubmissionFile,
} from '../../../src/services/courseService';
import { resolveLocale } from '@/src/utils/locale';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'text-amber-400',
  APPROVED: 'text-emerald-400',
  NEEDS_REVISION: 'text-red-400',
};

// Self-contained: fetches/manages its own submission for the active lesson
// so switching lessons doesn't leak stale state between them.
function AssignmentPanel({ lessonId, t }: { lessonId: string; t: TFunction; }) {
  const [submission, setSubmission] = useState<AssignmentSubmission | null | undefined>(undefined);
  const [linkUrl, setLinkUrl] = useState('');
  const [comment, setComment] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSubmission(undefined);
    setLinkUrl('');
    setComment('');
    setUploadedFileUrl(null);
    setError(null);
    getMySubmission(lessonId)
      .then(setSubmission)
      .catch(() => setSubmission(null));
  }, [lessonId]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      setUploadedFileUrl(await uploadSubmissionFile(lessonId, file));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const updated = await submitAssignment(lessonId, {
        fileUrl: uploadedFileUrl || undefined,
        linkUrl: linkUrl.trim() || undefined,
        comment: comment.trim() || undefined,
      });
      setSubmission(updated);
      setLinkUrl('');
      setComment('');
      setUploadedFileUrl(null);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submission === undefined) return null;

  if (submission && submission.status !== 'NEEDS_REVISION') {
    return (
      <div className="space-y-2">
        <p className={submission.status === 'APPROVED' ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
          {submission.status === 'APPROVED' ? t('assignmentApproved') : t('assignmentSubmitted')}
        </p>
        {submission.feedback && (
          <p className="text-xs text-slate-400">
            {t('assignmentFeedback')}: {submission.feedback}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {submission?.status === 'NEEDS_REVISION' && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3">
          <p className={`text-xs font-bold ${STATUS_BADGE.NEEDS_REVISION}`}>{t('assignmentNeedsRevision')}</p>
          {submission.feedback && <p className="text-xs text-slate-400 mt-1">{submission.feedback}</p>}
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="url"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder={t('assignmentLinkPlaceholder')}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
        />
        <textarea
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('assignmentCommentPlaceholder')}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
        />
        <label className="inline-block text-xs font-bold text-cyan-400 hover:text-cyan-300 cursor-pointer">
          {uploading ? '…' : uploadedFileUrl ? '✓ ' + t('assignmentUpload') : t('assignmentUpload')}
          <input type="file" onChange={handleFile} disabled={uploading} className="hidden" />
        </label>
        <button
          type="submit"
          disabled={submitting || uploading || (!linkUrl.trim() && !uploadedFileUrl)}
          className="block rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {submitting ? t('assignmentSubmitting') : submission ? t('assignmentResubmit') : t('assignmentSubmit')}
        </button>
      </form>
    </div>
  );
}

function LearnContent() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const { t } = useTranslation('courses');
  const courseId = typeof router.query.id === 'string' ? router.query.id : null;
  const { user } = useAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<LmsSection[]>([]);
  const [progress, setProgress] = useState<CourseProgressSummary | null>(null);
  const [examStatus, setExamStatus] = useState<ExamStatus | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [expandedSectionIds, setExpandedSectionIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'overview' | 'conspectus' | 'resources' | 'assignment' | 'discussion'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingCert, setDownloadingCert] = useState(false);
  const [showDownloadConfirm, setShowDownloadConfirm] = useState(false);
  const [certLimitReached, setCertLimitReached] = useState(false);

  useEscapeToClose(showDownloadConfirm, () => setShowDownloadConfirm(false));
  useEscapeToClose(certLimitReached, () => setCertLimitReached(false));

  const allLessons = useMemo(() => sections.flatMap((s) => s.lessons), [sections]);
  const activeLesson: LmsLesson | undefined = allLessons.find((l) => l.id === activeLessonId);

  // Conspectus is only ever generated in ka/en/ru (see subtitleService.ts —
  // matches the video's own caption languages, not the site's 6-locale
  // system). Same ka/en 2-way collapse as every other ka/en-only field in
  // this codebase (skills, marketplace categories, etc.) — de/es/fr/uk
  // visitors get the English conspectus, same as they already get English
  // course descriptions.
  const conspectusText = activeLesson ? (lang === 'ka' ? activeLesson.conspectusKa : activeLesson.conspectusEn) : null;

  const load = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setError(null);
    try {
      const [courseData, curriculumData, progressData, examStatusData] = await Promise.all([
        getCourse(courseId),
        getCurriculum(courseId),
        getProgressSummary(courseId),
        getExamStatus(courseId),
      ]);
      setCourse(courseData);
      setSections(curriculumData);
      setProgress(progressData);
      setExamStatus(examStatusData);
      setExpandedSectionIds(new Set(curriculumData.map((s) => s.id)));
      const firstIncomplete = curriculumData.flatMap((s) => s.lessons).find((l) => !l.completed);
      const first = curriculumData[0]?.lessons[0];
      setActiveLessonId((firstIncomplete ?? first)?.id ?? null);
    } catch {
      setError(t('notEnrolled'));
    } finally {
      setLoading(false);
    }
  }, [courseId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSection = (sectionId: string) => {
    setExpandedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const toggleLessonComplete = async (lesson: LmsLesson, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextCompleted = !lesson.completed;
    setSections((prev) =>
      prev.map((s) => ({ ...s, lessons: s.lessons.map((l) => (l.id === lesson.id ? { ...l, completed: nextCompleted } : l)) }))
    );
    try {
      await setLessonProgress(lesson.id, nextCompleted);
      if (courseId) setProgress(await getProgressSummary(courseId));
    } catch {
      setSections((prev) =>
        prev.map((s) => ({ ...s, lessons: s.lessons.map((l) => (l.id === lesson.id ? { ...l, completed: !nextCompleted } : l)) }))
      );
    }
  };

  // Same precedence as the backend's certificate generator — legal name if
  // both parts are set, else the display name. Shown in the pre-download
  // confirmation modal so the student can catch a wrong/misspelled name
  // before it ends up permanently printed on their certificate.
  const certificateNameKa =
    user?.legalFirstNameKa && user?.legalLastNameKa ? `${user.legalFirstNameKa} ${user.legalLastNameKa}` : user?.name ?? '';
  const certificateNameEn =
    user?.legalFirstNameEn && user?.legalLastNameEn ? `${user.legalFirstNameEn} ${user.legalLastNameEn}` : null;

  const handleDownloadCertificate = async () => {
    if (!courseId) return;
    setDownloadingCert(true);
    try {
      const blob = await downloadCertificate(courseId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate-${course?.title ?? courseId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      // downloadCertificate() requests responseType: 'blob' so a successful
      // PDF streams straight through — but that also means an error JSON
      // body (e.g. { error: 'DOWNLOAD_LIMIT_REACHED' }) arrives as a Blob
      // too, not a parsed object; axios doesn't re-parse it for us. Read it
      // back out as text before we can tell which error this actually is.
      const status = (err as { response?: { status?: number; data?: unknown } })?.response?.status;
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      let code: string | undefined;
      if (data instanceof Blob) {
        try {
          code = JSON.parse(await data.text())?.error;
        } catch {
          code = undefined;
        }
      } else if (data && typeof data === 'object') {
        code = (data as { error?: string }).error;
      }

      if (status === 403 && code === 'DOWNLOAD_LIMIT_REACHED') {
        setCertLimitReached(true);
      } else {
        setError('Unable to generate certificate.');
      }
    } finally {
      setDownloadingCert(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm">{t('loading')}</div>;
  }

  if (error || !course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-950 text-slate-300 text-sm">
        <SiteHeader />
        <p>{error ?? t('notEnrolled')}</p>
        <BackButton fallbackHref="/courses" className="text-slate-400 hover:text-slate-100" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Head>
        <title>{`${course.title} | CDC Learn`}</title>
      </Head>
      <SiteHeader />

      <div className="flex flex-col lg:flex-row">
        {/* MAIN CONTENT — ~70% */}
        <div className="flex-1 lg:w-[70%] p-4 md:p-8">
          <div className="mb-4">
            <BackButton fallbackHref={`/courses/${courseId}`} className="text-slate-400 hover:text-slate-100" />
          </div>
          <CourseVideoPlayer embedUrl={activeLesson?.embedUrl ?? null} title={activeLesson?.title ?? course.title} />

          <h1 className="text-xl font-bold mt-6">{activeLesson?.title ?? course.title}</h1>

          <div className="flex gap-2 mt-6 border-b border-slate-800">
            {(['overview', 'conspectus', 'resources', 'assignment', 'discussion'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors bg-transparent cursor-pointer ${
                  activeTab === tab ? 'border-cyan-400 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {t(tab)}
              </button>
            ))}
          </div>

          <div className="py-6 text-sm leading-relaxed text-slate-300">
            {activeTab === 'overview' && <p>{course.description}</p>}
            {activeTab === 'conspectus' &&
              (conspectusText ? (
                <MarkdownContent content={conspectusText} className="!text-slate-300" />
              ) : activeLesson?.conspectusStatus === 'PENDING' || activeLesson?.conspectusStatus === 'PROCESSING' ? (
                <p className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('conspectusGenerating')}
                </p>
              ) : activeLesson?.conspectusStatus === 'FAILED' ? (
                <p className="text-slate-500">{t('conspectusFailed')}</p>
              ) : (
                <p className="text-slate-500">{t('conspectusEmpty')}</p>
              ))}
            {activeTab === 'resources' &&
              (activeLesson?.resources.length ? (
                <ul className="space-y-2">
                  {activeLesson.resources.map((url, i) => (
                    <li key={i}>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline break-all">
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500">{t('noResources')}</p>
              ))}
            {activeTab === 'assignment' &&
              (activeLesson?.assignmentPrompt ? (
                <div className="space-y-4">
                  <p className="text-slate-200">{activeLesson.assignmentPrompt}</p>
                  <AssignmentPanel lessonId={activeLesson.id} t={t} />
                </div>
              ) : (
                <p className="text-slate-500">{t('noAssignment')}</p>
              ))}
            {activeTab === 'discussion' && courseId && <CourseDiscussionPanel courseId={courseId} lang={lang} />}
          </div>
        </div>

        {/* SIDEBAR — ~30% */}
        <aside className="lg:w-[30%] shrink-0 border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-900/40 p-4 md:p-6">
          <div className="mb-5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
              <span>{t('curriculum')}</span>
              <span>{progress?.percent ?? 0}% {t('completed')}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500"
                style={{ width: `${progress?.percent ?? 0}%` }}
              />
            </div>
          </div>

          {progress && progress.percent === 100 && examStatus?.configured && !examStatus.passed && (
            <Link
              href={`/courses/${courseId}/exam`}
              className="w-full mb-5 block text-center rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-white font-bold text-sm py-3 shadow-lg hover:shadow-xl transition-all"
            >
              {t('takeExam')}
            </Link>
          )}

          {progress && progress.percent === 100 && examStatus?.configured && examStatus.passed && (
            <button
              type="button"
              onClick={() => setShowDownloadConfirm(true)}
              disabled={downloadingCert}
              className="w-full mb-5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-sm py-3 shadow-lg hover:shadow-xl transition-all disabled:opacity-60"
            >
              {downloadingCert ? t('generating') : t('examPassed')}
            </button>
          )}

          {progress && progress.percent === 100 && examStatus && !examStatus.configured && (
            <button
              type="button"
              onClick={() => setShowDownloadConfirm(true)}
              disabled={downloadingCert}
              className="w-full mb-5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-sm py-3 shadow-lg hover:shadow-xl transition-all disabled:opacity-60"
            >
              {downloadingCert ? t('generating') : t('certificate')}
            </button>
          )}

          <div className="space-y-3">
            {sections.map((section) => {
              const expanded = expandedSectionIds.has(section.id);
              return (
                <div key={section.id} className="rounded-xl border border-slate-800 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/60 text-left text-sm font-semibold cursor-pointer border-none text-slate-100"
                  >
                    <span>{section.title}</span>
                    <span className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
                  </button>
                  {expanded && (
                    <div className="divide-y divide-slate-800/80">
                      {section.lessons.map((lesson) => (
                        <button
                          key={lesson.id}
                          type="button"
                          onClick={() => setActiveLessonId(lesson.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left text-xs cursor-pointer border-none transition-colors ${
                            lesson.id === activeLessonId ? 'bg-cyan-500/10 text-white' : 'bg-transparent text-slate-300 hover:bg-slate-800/60'
                          }`}
                        >
                          <span
                            role="checkbox"
                            aria-checked={lesson.completed}
                            onClick={(e) => toggleLessonComplete(lesson, e)}
                            className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                              lesson.completed ? 'bg-cyan-500 border-cyan-500 text-white' : 'border-slate-600 text-transparent'
                            }`}
                          >
                            ✓
                          </span>
                          <span className="flex-1 truncate">{lesson.title}</span>
                          <span className="shrink-0 text-slate-500">{formatDuration(lesson.durationSeconds)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {showDownloadConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={() => setShowDownloadConfirm(false)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-black mb-3">{t('confirmTitle')}</h2>
            <p className="text-sm text-slate-300 mb-2">{t('confirmBody')}</p>
            <p className="text-lg font-bold text-cyan-300 mb-1">{certificateNameKa}</p>
            {certificateNameEn && <p className="text-sm text-slate-400 mb-3">{certificateNameEn}</p>}
            <p className="text-xs text-slate-500 mb-6">{t('confirmChangeHint')}</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDownloadConfirm(false);
                  handleDownloadCertificate();
                }}
                disabled={downloadingCert}
                className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-sm py-3 shadow-lg hover:shadow-xl transition-all disabled:opacity-60"
              >
                {downloadingCert ? t('generating') : t('confirmDownload')}
              </button>
              <Link
                href="/dashboard/settings"
                className="w-full text-center rounded-xl border border-slate-700 text-slate-300 font-bold text-sm py-3 no-underline hover:bg-slate-800 transition-colors"
              >
                {t('confirmChangeName')}
              </Link>
              <button
                type="button"
                onClick={() => setShowDownloadConfirm(false)}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-300 bg-transparent border-none cursor-pointer py-1"
              >
                {t('confirmCancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {certLimitReached && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm px-4"
          onClick={() => setCertLimitReached(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900/90 backdrop-blur-md p-8 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30">
              <ShieldAlert className="h-7 w-7 text-amber-400" />
            </div>
            <h2 className="text-lg font-black text-white mb-3">{t('certLimitTitle')}</h2>
            <p className="text-sm text-slate-300 leading-relaxed mb-8">{t('certLimitSubtitle')}</p>
            <div className="flex flex-col gap-2.5">
              <Link
                href="/contact"
                className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm py-3 no-underline shadow-lg hover:shadow-xl hover:shadow-cyan-500/30 transition-all"
              >
                {t('certLimitContactSupport')}
              </Link>
              <button
                type="button"
                onClick={() => setCertLimitReached(false)}
                className="w-full text-center rounded-xl border border-white/10 text-slate-300 font-bold text-sm py-3 bg-transparent cursor-pointer hover:bg-white/5 hover:border-cyan-400/50 transition-all"
              >
                {t('back')}
              </button>
            </div>
          </div>
        </div>
      )}

      {courseId && activeLesson && (
        <CourseTutorPanel
          courseId={courseId}
          lessonId={activeLesson.id}
          courseTitle={course.title}
          lessonTitle={activeLesson.title}
          lang={lang}
        />
      )}
    </div>
  );
}

export default function LearnPage() {
  return (
    <ProtectedRoute>
      <LearnContent />
    </ProtectedRoute>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['courses'])) },
});
