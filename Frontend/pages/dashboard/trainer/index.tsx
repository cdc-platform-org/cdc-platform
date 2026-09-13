import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import ProtectedRoute from '@/src/components/auth/ProtectedRoute';
import SiteHeader from '@/src/components/layout/SiteHeader';
import {
  getTrainerMe,
  getMyAssignedTrainings,
  MyAssignedLiveTraining,
} from '@/src/services/trainerWorkspaceService';

// ============================================================
// IAKO Trainer Tools — Trainer Control Center (Phase 1).
// Lists only the Live Trainings this authenticated trainer is
// explicitly assigned to (server-side enforced). Also acts as
// the "am I a trainer at all?" gate for the whole /dashboard/trainer
// section — a non-trainer gets an explicit permission-denied card,
// never a stack trace or an infinite spinner.
// ============================================================

const copy = {
  ka: {
    title: 'ტრენერის მართვის პანელი',
    subtitle: 'თქვენი მინიჭებული ლაივ ტრენინგები',
    notTrainerTitle: 'ტრენერის წვდომა არ გაქვთ',
    notTrainerBody: 'ეს სექცია მხოლოდ აქტიური ტრენერებისთვისაა. გთხოვთ, დაუკავშირდეთ CDC-ის ადმინისტრაციას.',
    loading: 'იტვირთება…',
    error: 'ტრენინგების ჩატვირთვა ვერ მოხერხდა. სცადეთ ხელახლა.',
    retry: 'ხელახლა ცდა',
    empty: 'ჯერ არ გაქვთ მინიჭებული ლაივ ტრენინგები. მიმართეთ ადმინისტრატორს მინიჭებისთვის.',
    open: 'გახსნა',
    participants: 'მონაწილეები',
    guides: 'დღის გზამკვლევი',
    video: 'ვიდეო',
    viewAll: 'ნახვა',
  },
  en: {
    title: 'Trainer Control Center',
    subtitle: 'Your assigned live trainings',
    notTrainerTitle: 'No trainer access',
    notTrainerBody: 'This section is only for active trainers. Please contact CDC administration for access.',
    loading: 'Loading…',
    error: 'Could not load your trainings. Please try again.',
    retry: 'Retry',
    empty: 'You have not been assigned to any live trainings yet. Contact an administrator for assignment.',
    open: 'Open',
    participants: 'Participants',
    guides: 'Daily Guides',
    video: 'Video',
    viewAll: 'View',
  },
};

function TrainerDashboardContent() {
  const [me, setMe] = useState<{ isTrainer: boolean } | null>(null);
  const [trainings, setTrainings] = useState<MyAssignedLiveTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const lang = 'ka'; // i18n handled below via locale when needed; default matches codebase convention
  const t = copy[lang];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meResponse = await getTrainerMe();
        if (cancelled) return;
        setMe(meResponse);
        if (meResponse.isTrainer) {
          setTrainings(await getMyAssignedTrainings());
        }
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <p role="status" className="text-sm text-slate-500 dark:text-slate-400 p-6">{t.loading}</p>;
  }

  if (me && !me.isTrainer) {
    return (
      <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-6 m-6">
        <h2 className="text-lg font-black text-amber-900 dark:text-amber-200">{t.notTrainerTitle}</h2>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">{t.notTrainerBody}</p>
        <Link href="/dashboard" className="mt-4 inline-block rounded-lg bg-cyan-600 text-white px-4 py-2 text-sm font-bold">
          ← Dashboard
        </Link>
      </div>
    );
  }

  if (failed) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-6 m-6">
        <p className="text-sm text-red-700 dark:text-red-300">{t.error}</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-3 underline text-sm">{t.retry}</button>
      </div>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100">{t.title}</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.subtitle}</p>

      <div className="mt-6 space-y-3">
        {trainings.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.empty}</p>
        ) : (
          trainings.map((training) => (
            <div key={training.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">{training.category}</p>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate mt-0.5">{training.title}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {new Date(training.scheduledAt).toLocaleString()} · {training.participantCount} / {training.maxCapacity} {t.participants}
                  </p>
                </div>
                <Link href={`/dashboard/trainer/${training.id}`} className="rounded-lg bg-cyan-600 text-white px-4 py-2 text-sm font-bold">
                  {t.viewAll}
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}

export default function TrainerDashboardPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
        <Head><title>Trainer Control Center | CDC</title></Head>
        <SiteHeader />
        <TrainerDashboardContent />
      </div>
    </ProtectedRoute>
  );
}
