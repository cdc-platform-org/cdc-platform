/**
 * /dashboard/tools/course-mentor/learn/:courseId — Personal Mentor, a student's
 * course: progress, the lesson list by module, and the open lesson (mentor
 * chat + tasks, src/components/tools/courseMentor/learn/LessonSessionView.tsx).
 * Opens "today's" lesson (first due, unfinished) by default.
 */
import { useCallback, useEffect, useState } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { GraduationCap, Loader2, CheckCircle2, Circle, PlayCircle, PlayIcon } from 'lucide-react';
import ProtectedRoute from '../../../../../src/components/auth/ProtectedRoute';
import ToolErrorBoundary from '../../../../../src/components/common/ToolErrorBoundary';
import SEOHead from '../../../../../src/components/seo/SEOHead';
import ToolShell, { ToolPageHeader, ToolChip } from '../../../../../src/components/tools/ToolShell';
import LessonSessionView from '../../../../../src/components/tools/courseMentor/learn/LessonSessionView';
import { KIND_TONE } from '../../../../../src/components/tools/courseMentor/LessonCard';
import { getStudentCourse, startLesson, StudentCourse, LessonSession, apiErrorMessage } from '../../../../../src/services/courseMentorService';

function StudentCourseView({ courseId }: { courseId: string }) {
  const { t } = useTranslation('courseMentor');
  const { locale } = useRouter();
  const [course, setCourse] = useState<StudentCourse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [session, setSession] = useState<LessonSession | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => getStudentCourse(courseId).then((c) => {
    setCourse(c);
    setSelected((s) => s ?? c.currentLessonId);
  }).catch((err) => setError(apiErrorMessage(err, t('errors.load')))), [courseId, t]);

  useEffect(() => { load(); }, [load]);

  const open = async (lessonId: string) => {
    setSelected(lessonId);
    setOpening(true);
    setError(null);
    setSession(null);
    try {
      // start is idempotent: returns the existing session when there is one.
      setSession(await startLesson(courseId, lessonId, locale ?? 'ka'));
      load();
    } catch (err) {
      setError(apiErrorMessage(err, t('errors.generic')));
    } finally {
      setOpening(false);
    }
  };

  if (!course) {
    return (
      <ToolShell backHref="/dashboard/tools/course-mentor/learn">
        {error ? <p role="alert" className="text-sm font-semibold text-red-600">{error}</p> : <Loader2 className="w-6 h-6 animate-spin text-cdc-muted" aria-label={t('loading')} />}
      </ToolShell>
    );
  }

  const lesson = course.lessons.find((l) => l.id === selected) ?? null;
  const pct = course.progress.total ? Math.round((course.progress.completed / course.progress.total) * 100) : 0;

  return (
    <ToolShell backHref="/dashboard/tools/course-mentor/learn">
      <ToolPageHeader
        icon={GraduationCap}
        accent="purple"
        title={course.title}
        subtitle={t('learn.progressLong', { done: course.progress.completed, total: course.progress.total, due: course.progress.dueByToday })}
        chips={course.progress.averageScore !== null ? <ToolChip tone="brand">{t('learn.average', { score: course.progress.averageScore })}</ToolChip> : undefined}
      />
      <div className="h-2 rounded-full bg-cdc-surface border border-cdc-border overflow-hidden mb-6"><div className="h-full bg-cdc-primary" style={{ width: `${pct}%` }} /></div>
      {error && <p role="alert" className="text-sm font-semibold text-red-600 mb-4">{error}</p>}

      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        <nav aria-label={t('learn.lessons')} className="rounded-2xl border border-cdc-border bg-cdc-surface p-3 max-h-[80vh] overflow-y-auto">
          {course.modules.map((m) => (
            <div key={m.id} className="mb-3">
              <p className="px-2 py-1 text-xs font-extrabold text-cdc-muted uppercase">{t('plan.module', { n: m.position })}: {m.title}</p>
              <ul>
                {course.lessons.filter((l) => l.moduleId === m.id).map((l) => (
                  <li key={l.id}>
                    <button type="button" onClick={() => open(l.id)} aria-current={l.id === selected ? 'true' : undefined}
                      className={`w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm border-none cursor-pointer ${l.id === selected ? 'bg-cdc-primary-soft text-cdc-primary-ink font-bold' : 'bg-transparent text-cdc-ink'}`}>
                      {l.status === 'COMPLETED' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" aria-label={t('learn.statusDone')} />
                        : l.status === 'IN_PROGRESS' ? <PlayCircle className="w-4 h-4 shrink-0 text-cdc-primary" aria-label={t('learn.statusActive')} />
                        : <Circle className="w-4 h-4 shrink-0 text-cdc-muted" aria-hidden />}
                      <span className="flex-1 truncate">{l.position}. {l.title}</span>
                      {l.score !== null && <span className="text-xs text-cdc-muted">{Math.round(l.score)}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div>
          {lesson && (
            <div className="rounded-2xl border border-cdc-border bg-cdc-surface p-4 md:p-5 mb-4">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${KIND_TONE[lesson.kind]}`}>{t(`kind.${lesson.kind}`)}</span>
                <span className="text-xs text-cdc-muted">{lesson.date}</span>
              </div>
              <h2 className="text-lg font-extrabold text-cdc-ink">{lesson.position}. {lesson.title}</h2>
              <ul className="list-disc pl-5 text-sm text-cdc-muted mt-2">{lesson.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul>
              {!session && (
                <button type="button" onClick={() => open(lesson.id)} disabled={opening}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cdc-primary px-5 py-2.5 text-sm font-bold text-white border-none cursor-pointer disabled:opacity-60">
                  {opening ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <PlayIcon className="w-4 h-4" aria-hidden />}
                  {lesson.status === 'NOT_STARTED' ? t('learn.startLesson') : t('learn.continueLesson')}
                </button>
              )}
            </div>
          )}
          {session && <LessonSessionView initial={session} />}
          {!lesson && <p className="text-sm text-cdc-muted">{t('learn.allDone')}</p>}
        </div>
      </div>
    </ToolShell>
  );
}

export default function StudentCoursePage() {
  const { t } = useTranslation('courseMentor');
  const router = useRouter();
  const courseId = typeof router.query.courseId === 'string' ? router.query.courseId : null;
  return (
    <>
      <SEOHead title={t('pageTitle')} description={t('learn.subtitle')} noIndex />
      <ProtectedRoute>
        <ToolErrorBoundary>{courseId && <StudentCourseView courseId={courseId} />}</ToolErrorBoundary>
      </ProtectedRoute>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['common', 'courseMentor'])) },
});
