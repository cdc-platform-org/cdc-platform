/**
 * /dashboard/tools/course-mentor — AI Course Mentor, teacher's course list and
 * "new course" form. Course detail (documents, plan) is [id].tsx; UI parts in
 * src/components/tools/courseMentor/; API in src/services/courseMentorService.ts.
 */
import { useEffect, useState } from 'react';
import { GetServerSideProps } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { GraduationCap, Plus, Loader2, ChevronRight } from 'lucide-react';
import ProtectedRoute from '../../../../src/components/auth/ProtectedRoute';
import AdminOnlyToolGate from '../../../../src/components/tools/AdminOnlyToolGate';
import ToolErrorBoundary from '../../../../src/components/common/ToolErrorBoundary';
import SEOHead from '../../../../src/components/seo/SEOHead';
import ToolShell, { ToolPageHeader } from '../../../../src/components/tools/ToolShell';
import CourseForm, { emptyCourseInput } from '../../../../src/components/tools/courseMentor/CourseForm';
import StatusChip from '../../../../src/components/tools/courseMentor/StatusChip';
import { listCourses, createCourse, MentorCourseListItem, CourseInput, apiErrorMessage } from '../../../../src/services/courseMentorService';

function CourseMentorHome() {
  const { t } = useTranslation('courseMentor');
  const router = useRouter();
  const [courses, setCourses] = useState<MentorCourseListItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    listCourses()
      .then((c) => {
        setCourses(c);
        if (c.length === 0) setShowForm(true);
      })
      .catch((err) => setLoadError(apiErrorMessage(err, t('errors.load'))));
  }, [t]);

  const onCreate = async (input: CourseInput) => {
    setBusy(true);
    setFormError(null);
    try {
      const id = await createCourse(input);
      router.push(`/dashboard/tools/course-mentor/${id}`);
    } catch (err) {
      setFormError(apiErrorMessage(err, t('errors.generic')));
      setBusy(false);
    }
  };

  return (
    <ToolShell backHref="/dashboard/tools">
      <ToolPageHeader
        icon={GraduationCap}
        accent="purple"
        title={t('pageTitle')}
        subtitle={t('pageSubtitle')}
        actions={
          !showForm && (
            <button type="button" onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-cdc-primary px-4 py-2.5 text-sm font-bold text-white border-none cursor-pointer">
              <Plus className="w-4 h-4" aria-hidden />{t('actions.newCourse')}
            </button>
          )
        }
      />

      {showForm && (
        <section className="rounded-2xl border border-cdc-border bg-cdc-surface p-4 md:p-6 mb-8">
          <h2 className="text-lg font-extrabold text-cdc-ink mb-1">{t('newCourse.title')}</h2>
          <p className="text-sm text-cdc-muted mb-5">{t('newCourse.subtitle')}</p>
          <CourseForm initial={emptyCourseInput(router.locale ?? 'ka')} submitLabel={t('actions.createCourse')} busy={busy} error={formError} onSubmit={onCreate} />
        </section>
      )}

      {loadError && <p role="alert" className="text-sm font-semibold text-red-600">{loadError}</p>}
      {!courses && !loadError && <Loader2 className="w-6 h-6 animate-spin text-cdc-muted" aria-label={t('loading')} />}
      {courses && courses.length > 0 && (
        <ul className="grid gap-3">
          {courses.map((c) => (
            <li key={c.id}>
              <Link href={`/dashboard/tools/course-mentor/${c.id}`}
                className="flex items-center gap-4 rounded-2xl border border-cdc-border bg-cdc-surface p-4 no-underline hover:border-cdc-primary/40">
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-cdc-ink truncate">{c.title}</p>
                  <p className="text-xs text-cdc-muted">
                    {c.startDate} – {c.endDate} · {t('list.documents', { count: c._count.documents })} · {t('plan.lessonsCount', { count: c._count.lessons })}
                  </p>
                </div>
                <StatusChip status={c.status} />
                <ChevronRight className="w-5 h-5 text-cdc-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ToolShell>
  );
}

export default function CourseMentorPage() {
  const { t } = useTranslation('courseMentor');
  return (
    <>
      <SEOHead title={t('pageTitle')} description={t('pageSubtitle')} noIndex />
      <ProtectedRoute>
        <ToolErrorBoundary>
          <AdminOnlyToolGate slug="course-mentor"><CourseMentorHome /></AdminOnlyToolGate>
        </ToolErrorBoundary>
      </ProtectedRoute>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['common', 'courseMentor'])) },
});
