import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { Video, Radio, PlayCircle, X, GraduationCap, CheckCircle2 } from 'lucide-react';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import { getMyLiveTrainingEnrollments, cancelLiveTrainingEnrollment } from '../../src/services/liveTrainingService';
import { MyLiveTrainingEnrollment } from '../../src/types/liveTraining';
import { resolveLocale } from '../../src/utils/locale';

const EN_STRINGS = {
  title: 'Live Trainings',
  subtitle: 'Sessions you’re enrolled in — join links and recordings appear here.',
  loading: 'Loading…',
  empty: 'You are not enrolled in any live training yet.',
  browse: 'Browse live trainings',
  joinNow: 'Join session',
  linkNotYet: 'The join link isn’t open yet — it appears here shortly before the session starts.',
  classroom: 'Open Classroom',
  recording: 'Watch recording',
  recordingPending: 'No recording has been posted yet.',
  scheduledFor: 'Scheduled for',
  completed: 'Completed 🎓',
  cancel: 'Cancel enrollment',
  cancelling: 'Cancelling…',
  cancelConfirm: 'Cancel your enrollment in this training?',
  cancelError: 'Could not cancel — please try again.',
};

const dict = {
  ka: {
    title: 'ლაივ ტრენინგები',
    subtitle: 'ტრენინგები, რომლებზეც ხართ ჩარიცხული — მიერთების ბმულები და ჩანაწერები აქ გამოჩნდება.',
    loading: 'იტვირთება…',
    empty: 'თქვენ ჯერ არცერთ ლაივ ტრენინგზე არ ხართ ჩარიცხული.',
    browse: 'ლაივ ტრენინგების ნახვა',
    joinNow: 'სესიაში შესვლა',
    linkNotYet: 'მიერთების ბმული ჯერ არ არის ღია — ის სესიის დაწყებამდე ცოტა ხნით ადრე გამოჩნდება.',
    classroom: 'Classroom-ის გახსნა',
    recording: 'ჩანაწერის ნახვა',
    recordingPending: 'ჩანაწერი ჯერ არ არის ატვირთული.',
    scheduledFor: 'დაგეგმილია',
    completed: 'დასრულებული 🎓',
    cancel: 'ჩარიცხვის გაუქმება',
    cancelling: 'უქმდება…',
    cancelConfirm: 'გავაუქმოთ ჩარიცხვა ამ ტრენინგზე?',
    cancelError: 'გაუქმება ვერ მოხერხდა — სცადეთ თავიდან.',
  },
  en: EN_STRINGS,
  de: EN_STRINGS,
  es: EN_STRINGS,
  fr: EN_STRINGS,
  uk: EN_STRINGS,
};

function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale === 'ka' ? 'ka-GE' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function EnrollmentCard({
  enrollment,
  lang,
  onCancelled,
}: {
  enrollment: MyLiveTrainingEnrollment;
  lang: keyof typeof dict;
  onCancelled: () => void;
}) {
  const t = dict[lang];
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const title = lang === 'ka' ? enrollment.title : enrollment.titleEn || enrollment.title;

  const handleCancel = async () => {
    if (!window.confirm(t.cancelConfirm)) return;
    setCancelling(true);
    setError(null);
    try {
      await cancelLiveTrainingEnrollment(enrollment.liveTrainingId);
      onCancelled();
    } catch {
      setError(t.cancelError);
      setCancelling(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900 dark:text-white">{title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t.scheduledFor} {formatDateTime(enrollment.startDate ?? enrollment.scheduledAt, lang)}
          </p>
        </div>
        {enrollment.status === 'COMPLETED' ? (
          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t.completed}
          </span>
        ) : (
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelling}
            className="flex items-center gap-1 text-[11px] font-bold text-red-500 hover:text-red-600 bg-transparent border-none cursor-pointer disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" />
            {cancelling ? t.cancelling : t.cancel}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

      <div className="flex flex-wrap gap-2 mt-4">
        {enrollment.meetingUrl ? (
          <a
            href={enrollment.meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white no-underline"
          >
            <Radio className="w-3.5 h-3.5" />
            {t.joinNow}
          </a>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-md">{t.linkNotYet}</p>
        )}

        {enrollment.classroomUrl && (
          <a
            href={enrollment.classroomUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 no-underline"
          >
            <GraduationCap className="w-3.5 h-3.5" />
            {t.classroom}
          </a>
        )}

        {enrollment.recordingUrl && (
          <a
            href={enrollment.recordingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 no-underline"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            {t.recording}
          </a>
        )}
      </div>
    </div>
  );
}

function LiveTrainingsContent() {
  const router = useRouter();
  const lang = resolveLocale(router.locale) as keyof typeof dict;
  const t = dict[lang];
  const [enrollments, setEnrollments] = useState<MyLiveTrainingEnrollment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEnrollments(await getMyLiveTrainingEnrollments());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${t.title} | CDC Platform`}</title>
      </Head>
      <SiteHeader />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 w-full">
        <BackButton fallbackHref="/dashboard" className="dark:text-slate-400 dark:hover:text-slate-100" />
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 md:py-12 flex-1 w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-black tracking-wide flex items-center gap-2">
            <Video className="w-6 h-6 text-cyan-500" />
            {t.title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.subtitle}</p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.loading}</p>
        ) : enrollments.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-10 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t.empty}</p>
            <Link
              href="/live-trainings"
              className="inline-block text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-cyan-600 text-white no-underline"
            >
              {t.browse}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {enrollments.map((e) => (
              <EnrollmentCard key={e.enrollmentId} enrollment={e} lang={lang} onCancelled={load} />
            ))}
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}

export default function LiveTrainingsPage() {
  return (
    <ProtectedRoute>
      <LiveTrainingsContent />
    </ProtectedRoute>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['common'])) },
});
