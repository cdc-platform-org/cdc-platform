/**
 * /dashboard/tools/course-mentor/:id — one AI Course Mentor course: source
 * documents, "build the plan" with live progress, the generated plan (editable),
 * approval, join code and settings. Polls the course while documents are
 * processing or the planner is running.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { GraduationCap, Sparkles, Loader2, CheckCircle2, Settings, KeyRound, Copy, AlertTriangle, Archive } from 'lucide-react';
import ProtectedRoute from '../../../../src/components/auth/ProtectedRoute';
import AdminOnlyToolGate from '../../../../src/components/tools/AdminOnlyToolGate';
import ToolErrorBoundary from '../../../../src/components/common/ToolErrorBoundary';
import SEOHead from '../../../../src/components/seo/SEOHead';
import ToolShell, { ToolPageHeader } from '../../../../src/components/tools/ToolShell';
import CourseForm from '../../../../src/components/tools/courseMentor/CourseForm';
import DocumentsPanel from '../../../../src/components/tools/courseMentor/DocumentsPanel';
import PlanView from '../../../../src/components/tools/courseMentor/PlanView';
import StatusChip from '../../../../src/components/tools/courseMentor/StatusChip';
import {
  getCourse, updateCourse, startPlanning, approvePlan, archiveCourse,
  MentorCourseDetail, MentorLesson, CourseInput, apiErrorMessage,
} from '../../../../src/services/courseMentorService';

const POLL_MS = 4000;

function CourseMentorDetail({ id }: { id: string }) {
  const { t } = useTranslation('courseMentor');
  const router = useRouter();
  const [course, setCourse] = useState<MentorCourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'plan' | 'approve' | 'settings' | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const c = await getCourse(id);
      setCourse(c);
      setError(null);
      return c;
    } catch (err) {
      setError(apiErrorMessage(err, t('errors.load')));
      return null;
    }
  }, [id, t]);

  // Poll only while something is running in the background.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const c = await load();
      if (!alive || !c) return;
      const running = c.status === 'PLANNING' || c.documents.some((d) => d.status === 'PROCESSING');
      if (running) timer.current = setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load, course?.status === 'PLANNING', course?.documents.some((d) => d.status === 'PROCESSING')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!course) {
    return (
      <ToolShell backHref="/dashboard/tools/course-mentor">
        {error ? <p role="alert" className="text-sm font-semibold text-red-600">{error}</p> : <Loader2 className="w-6 h-6 animate-spin text-cdc-muted" aria-label={t('loading')} />}
      </ToolShell>
    );
  }

  const planning = course.status === 'PLANNING';
  const processing = course.documents.some((d) => d.status === 'PROCESSING');
  const hasReadyDocs = course.documents.some((d) => d.status === 'READY');
  const hasPlan = course.lessons.length > 0;

  const runPlanner = async () => {
    if (hasPlan && !window.confirm(t('plan.confirmRebuild'))) return;
    setBusy('plan');
    try {
      await startPlanning(course.id);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(null);
    }
  };

  const approve = async () => {
    setBusy('approve');
    try {
      await approvePlan(course.id);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(null);
    }
  };

  const saveSettings = async (input: CourseInput) => {
    setBusy('settings');
    try {
      await updateCourse(course.id, input);
      setShowSettings(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(null);
    }
  };

  const archive = async () => {
    if (!window.confirm(t('actions.confirmArchive'))) return;
    await archiveCourse(course.id).catch(() => undefined);
    router.push('/dashboard/tools/course-mentor');
  };

  const onLessonSaved = (lesson: MentorLesson) =>
    setCourse((c) => (c ? { ...c, lessons: c.lessons.map((l) => (l.id === lesson.id ? { ...l, ...lesson } : l)) } : c));

  const copyCode = async () => {
    await navigator.clipboard?.writeText(course.joinCode).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const progress = course.planProgress;
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <ToolShell backHref="/dashboard/tools/course-mentor">
      <ToolPageHeader
        icon={GraduationCap}
        accent="purple"
        title={course.title}
        subtitle={t('detail.subtitle', { start: course.startDate, end: course.endDate, days: course.classDays, minutes: course.minutesPerLesson })}
        chips={<StatusChip status={course.status} />}
        actions={
          <>
            <button type="button" onClick={() => setShowSettings((s) => !s)}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-cdc-ink bg-cdc-surface border border-cdc-border cursor-pointer">
              <Settings className="w-4 h-4" aria-hidden />{t('actions.settings')}
            </button>
            <button type="button" onClick={archive} aria-label={t('actions.archive')}
              className="inline-flex items-center rounded-xl p-2.5 text-cdc-muted bg-cdc-surface border border-cdc-border cursor-pointer">
              <Archive className="w-4 h-4" aria-hidden />
            </button>
          </>
        }
      />

      {error && <p role="alert" className="text-sm font-semibold text-red-600 mb-4">{error}</p>}

      {showSettings && (
        <section className="rounded-2xl border border-cdc-border bg-cdc-surface p-4 md:p-6 mb-6">
          <p className="text-sm text-cdc-muted mb-4">{t('detail.settingsHint')}</p>
          <CourseForm initial={{
            title: course.title, audience: course.audience, goals: course.goals, instructions: course.instructions,
            teachingLocale: course.teachingLocale, startDate: course.startDate, endDate: course.endDate,
            weekdays: course.weekdays, minutesPerLesson: course.minutesPerLesson, excludedDates: course.excludedDates,
          }}submitLabel={t('actions.save')} busy={busy === 'settings'} error={null} onSubmit={saveSettings} />
        </section>
      )}

      <div className="grid gap-6">
        <DocumentsPanel courseId={course.id} documents={course.documents} locked={planning} onChanged={load} />

        <section className="rounded-2xl border border-cdc-border bg-cdc-surface p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="max-w-2xl">
              <h2 className="text-lg font-extrabold text-cdc-ink">{t('plan.title')}</h2>
              <p className="text-sm text-cdc-muted">{t('plan.subtitle')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={runPlanner} disabled={planning || processing || !hasReadyDocs || busy === 'plan'}
                className="inline-flex items-center gap-2 rounded-xl bg-cdc-primary px-4 py-2.5 text-sm font-bold text-white border-none cursor-pointer disabled:opacity-60">
                {planning || busy === 'plan' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Sparkles className="w-4 h-4" aria-hidden />}
                {hasPlan ? t('plan.rebuild') : t('plan.build')}
              </button>
              {course.status === 'PLAN_READY' && (
                <button type="button" onClick={approve} disabled={busy === 'approve'}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white border-none cursor-pointer disabled:opacity-60">
                  <CheckCircle2 className="w-4 h-4" aria-hidden />{t('plan.approve')}
                </button>
              )}
            </div>
          </div>

          {!hasReadyDocs && !processing && <p className="text-sm text-cdc-muted mt-3">{t('plan.needDocuments')}</p>}
          {processing && <p className="text-sm text-cdc-muted mt-3">{t('plan.waitDocuments')}</p>}
          {planning && (
            <div className="mt-4" aria-live="polite">
              <p className="text-sm font-semibold text-cdc-ink mb-2">
                {progress?.step === 'lessons' ? t('plan.progressLessons', { done: progress.done, total: progress.total }) : t('plan.progressStructure')}
              </p>
              <div className="h-2 rounded-full bg-cdc-bg overflow-hidden">
                <div className="h-full bg-cdc-primary transition-all" style={{ width: `${Math.max(5, pct)}%` }} />
              </div>
              <p className="text-xs text-cdc-muted mt-2">{t('plan.progressHint')}</p>
            </div>
          )}
          {course.status === 'PLAN_FAILED' && (
            <p role="alert" className="mt-4 inline-flex items-start gap-2 text-sm font-semibold text-red-600">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />{t('plan.failed')} {course.planError}
            </p>
          )}
          {course.status === 'ACTIVE' && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-3">
              <KeyRound className="w-5 h-5 text-emerald-700 dark:text-emerald-300" aria-hidden />
              <span className="text-sm text-emerald-900 dark:text-emerald-200">{t('detail.joinCode')}</span>
              <code className="text-lg font-extrabold tracking-widest text-emerald-900 dark:text-emerald-100">{course.joinCode}</code>
              <button type="button" onClick={copyCode} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold bg-transparent border border-emerald-300 text-emerald-800 dark:text-emerald-200 cursor-pointer">
                <Copy className="w-3.5 h-3.5" aria-hidden />{copied ? t('actions.copied') : t('actions.copy')}
              </button>
              <span className="text-xs text-emerald-800 dark:text-emerald-300 w-full">{t('detail.joinCodeHint')}</span>
            </div>
          )}
        </section>

        {hasPlan && !planning && <PlanView course={course} locale={router.locale ?? 'ka'} onLessonSaved={onLessonSaved} />}
      </div>
    </ToolShell>
  );
}

export default function CourseMentorDetailPage() {
  const { t } = useTranslation('courseMentor');
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : null;
  return (
    <>
      <SEOHead title={t('pageTitle')} description={t('pageSubtitle')} noIndex />
      <ProtectedRoute>
        <ToolErrorBoundary>
          <AdminOnlyToolGate slug="course-mentor">{id && <CourseMentorDetail id={id} />}</AdminOnlyToolGate>
        </ToolErrorBoundary>
      </ProtectedRoute>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['common', 'courseMentor'])) },
});
