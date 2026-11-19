/**
 * /dashboard/tools/course-mentor/learn — Personal Mentor, student home: join a
 * class with the teacher's code and see my courses. A lesson itself is
 * [courseId].tsx. Students don't pay; access follows the teacher's plan.
 */
import { FormEvent, useEffect, useState } from 'react';
import { GetServerSideProps } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { GraduationCap, KeyRound, Loader2, ChevronRight } from 'lucide-react';
import ProtectedRoute from '../../../../../src/components/auth/ProtectedRoute';
import ToolErrorBoundary from '../../../../../src/components/common/ToolErrorBoundary';
import SEOHead from '../../../../../src/components/seo/SEOHead';
import ToolShell, { ToolPageHeader } from '../../../../../src/components/tools/ToolShell';
import ToolMediaBanner from '../../../../../src/components/tools/ToolMediaBanner';
import { inputClass } from '../../../../../src/components/tools/courseMentor/CourseForm';
import { joinMentorCourse, listMyMentorCourses, MyMentorCourse, apiErrorMessage } from '../../../../../src/services/courseMentorService';

function LearnHome() {
  const { t } = useTranslation('courseMentor');
  const router = useRouter();
  const [courses, setCourses] = useState<MyMentorCourse[] | null>(null);
  const [code, setCode] = useState(typeof router.query.code === 'string' ? router.query.code : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyMentorCourses().then(setCourses).catch((err) => setError(apiErrorMessage(err, t('errors.load'))));
  }, [t]);

  const join = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { courseId } = await joinMentorCourse(code);
      router.push(`/dashboard/tools/course-mentor/learn/${courseId}`);
    } catch (err) {
      setError(apiErrorMessage(err, t('errors.generic')));
      setBusy(false);
    }
  };

  return (
    <ToolShell backHref="/dashboard">
      <ToolPageHeader icon={GraduationCap} accent="purple" title={t('pageTitle')} subtitle={t('learn.subtitle')} />
      <ToolMediaBanner slug="course-mentor" alt={t('pageTitle')} />

      <form onSubmit={join} className="rounded-2xl border border-cdc-border bg-cdc-surface p-4 md:p-6 mb-6 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <label htmlFor="cm-join" className="block text-sm font-bold text-cdc-ink mb-1.5">{t('learn.joinLabel')}</label>
          <input id="cm-join" className={`${inputClass} uppercase tracking-widest font-bold`} value={code} maxLength={20}
            onChange={(e) => setCode(e.target.value)} placeholder="ABC2345" autoComplete="off" />
        </div>
        <button type="submit" disabled={busy || code.trim().length < 4}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cdc-primary px-5 py-2.5 text-sm font-bold text-white border-none cursor-pointer disabled:opacity-60">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <KeyRound className="w-4 h-4" aria-hidden />}{t('learn.join')}
        </button>
      </form>

      {error && <p role="alert" className="text-sm font-semibold text-red-600 mb-4">{error}</p>}
      {!courses && !error && <Loader2 className="w-6 h-6 animate-spin text-cdc-muted" aria-label={t('loading')} />}
      {courses && courses.length === 0 && <p className="text-sm text-cdc-muted">{t('learn.noCourses')}</p>}
      {courses && courses.length > 0 && (
        <ul className="grid gap-3">
          {courses.map((c) => {
            const pct = c.lessonCount ? Math.round((c.completedLessons / c.lessonCount) * 100) : 0;
            return (
              <li key={c.courseId}>
                <Link href={`/dashboard/tools/course-mentor/learn/${c.courseId}`} className="flex items-center gap-4 rounded-2xl border border-cdc-border bg-cdc-surface p-4 no-underline hover:border-cdc-primary/40">
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-cdc-ink truncate">{c.title}</p>
                    <p className="text-xs text-cdc-muted mb-2">{t('learn.progressShort', { done: c.completedLessons, total: c.lessonCount })}</p>
                    <div className="h-1.5 rounded-full bg-cdc-bg overflow-hidden"><div className="h-full bg-cdc-primary" style={{ width: `${pct}%` }} /></div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-cdc-muted" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </ToolShell>
  );
}

export default function LearnPage() {
  const { t } = useTranslation('courseMentor');
  return (
    <>
      <SEOHead title={t('pageTitle')} description={t('learn.subtitle')} noIndex />
      <ProtectedRoute>
        <ToolErrorBoundary><LearnHome /></ToolErrorBoundary>
      </ProtectedRoute>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['common', 'courseMentor'])) },
});
