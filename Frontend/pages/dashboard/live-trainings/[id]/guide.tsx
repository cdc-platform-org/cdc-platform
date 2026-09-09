import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ProtectedRoute from '@/src/components/auth/ProtectedRoute';
import SiteHeader from '@/src/components/layout/SiteHeader';
import TrainingDayContent from '@/src/components/training-guides/TrainingDayContent';
import { getLearnerGuide, GuideSection, LearnerGuide, TrainingDay, updateGuideProgress } from '@/src/services/trainingGuideService';

const copy = {
  ka: { title: 'დღევანდელი გზამკვლევი', day: 'დღე', view: 'დღევანდელი გზამკვლევის ნახვა', ask: 'ჰკითხე IAKO-ს', progress: 'ჩემი პროგრესი', today: 'დღეს', completed: 'გავლილი', upcoming: 'წინ არის', loading: 'იტვირთება…', empty: 'გზამკვლევი ჯერ არ გამოქვეყნებულა. მოგვიანებით დაბრუნდით.', noToday: 'დღეს ახალი სასწავლო დღე არ არის. შეგიძლია უკვე გახსნილი მასალა გაიმეორო.', loadError: 'გზამკვლევი ვერ ჩაიტვირთა. შეამოწმეთ ტრენინგზე წვდომა და სცადეთ თავიდან.', retry: 'ხელახლა ცდა', paused: 'განრიგი შეჩერებულია', timezone: 'ტრენინგის დროის სარტყელი', of: 'დასრულებულია', progressHelp: 'შენი პირადი პროგრესი — მონიშვნები სასწავლო პროგრამას არ ცვლის.', progressError: 'პროგრესი ვერ შეინახა. სცადეთ თავიდან.', exercise: 'დღის პრაქტიკული დავალება', objectives: 'დღეს ვისწავლით', guide: 'სრული გზამკვლევი', date: 'თარიღი', askAboutDay: (n: number) => `ჰკითხე IAKO-ს დღე ${n}-ზე` },
  en: { title: "Today's guide", day: 'Day', view: "Open today's guide", ask: 'Ask IAKO', progress: 'My progress', today: 'Today', completed: 'Previous', upcoming: 'Upcoming', loading: 'Loading…', empty: 'Your guide has not been published yet. Please check back later.', noToday: 'There is no new training day today. You can revisit the available material.', loadError: 'Could not load the guide. Check your training access and try again.', retry: 'Try again', paused: 'Schedule paused', timezone: 'Training time zone', of: 'completed', progressHelp: 'Your personal progress — checkmarks do not change the syllabus.', progressError: 'Could not save progress. Please try again.', exercise: 'Practical exercise', objectives: 'Today we will learn', guide: 'Full guide', date: 'Date', askAboutDay: (n: number) => `Ask IAKO about Day ${n}` },
};

function DailyGuideContent() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  const lang = router.locale === 'ka' ? 'ka' : 'en';
  const t = copy[lang];
  const [guide, setGuide] = useState<LearnerGuide | null>(null);
  const [selectedDayId, setSelectedDayId] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [progressError, setProgressError] = useState(false);
  const [busyItems, setBusyItems] = useState<string[]>([]);
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setFailed(false);
    try {
      const data = await getLearnerGuide(id);
      setGuide(data);
      setSelectedDayId((selected) => data.days.some((day) => day.id === selected) ? selected : (data.days.find((day) => day.status === 'today') ?? data.days[data.days.length - 1])?.id ?? '');
    } catch { setFailed(true); setGuide(null); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  const today = guide?.days.find((day) => day.status === 'today');
  const selectedDay = guide?.days.find((day) => day.id === selectedDayId);
  const totalItems = guide?.days.reduce((total, day) => total + day.sections.reduce((count, section) => count + section.items.length, 0), 0) ?? 0;
  const completedItems = guide?.days.reduce((total, day) => total + day.completedItemIds.length, 0) ?? 0;

  // Navigates into the primary IAKO mentor conversation with this specific
  // day/section as server-side context (see IakoMentorPage's topicContext
  // handling) — Daily Guides is a resource IAKO consults, not a second,
  // separate assistant with its own siloed history.
  const askIako = (day?: TrainingDay, section?: GuideSection) => {
    const topic = day ? `${t.day} ${day.dayNumber}: ${day.title}${section ? ` — ${section.title}` : ''}` : undefined;
    void router.push({ pathname: `/dashboard/live-trainings/${id}/iako`, query: topic ? { topic } : {} });
  };
  const toggleProgress = async (day: TrainingDay, itemId: string, completed: boolean) => {
    setProgressError(false); setBusyItems((items) => [...items, itemId]);
    try {
      await updateGuideProgress(id, day.id, itemId, completed);
      setGuide((current) => current ? { ...current, days: current.days.map((entry) => entry.id === day.id ? { ...entry, completedItemIds: completed ? Array.from(new Set([...entry.completedItemIds, itemId])) : entry.completedItemIds.filter((item) => item !== itemId) } : entry) } : current);
    } catch { setProgressError(true); }
    finally { setBusyItems((items) => items.filter((item) => item !== itemId)); }
  };

  return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
    <Head><title>IAKO · {t.title} | CDC</title></Head>
    <SiteHeader />
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <Link href={`/dashboard/live-trainings/${id}/iako`} className="text-sm text-cyan-700 dark:text-cyan-300">← IAKO</Link>
      <div className="my-6"><p className="text-sm font-bold text-cyan-600 dark:text-cyan-400">IAKO · {guide?.training.title}</p><h1 className="text-3xl sm:text-4xl font-black mt-2">{t.title}</h1></div>
      {loading ? <p role="status">{t.loading}</p> : failed ? <div role="alert" className="rounded-2xl border border-red-200 p-6"><p>{t.loadError}</p><button type="button" onClick={() => void load()} className="mt-3 underline">{t.retry}</button></div> : guide && <>
        <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400 mb-5"><span>{t.timezone}: {guide.settings.timeZone}</span>{guide.settings.paused && <span className="font-bold text-amber-600">{t.paused}</span>}</div>
        <section aria-label={t.title} className="rounded-3xl bg-gradient-to-br from-cyan-950 to-slate-900 text-white p-6 sm:p-8 mb-7">
          {today ? <>
            <p className="text-cyan-300 font-bold text-sm">{t.day} {today.dayNumber} · {t.today}</p><h2 className="text-2xl sm:text-3xl font-black mt-2">{today.title}</h2>
            <p className="text-slate-300 mt-3 leading-7">{today.summary}</p>
            {today.sections.find((section) => section.kind === 'objectives') && <div className="mt-5"><h3 className="font-bold">{t.objectives}</h3><ul className="mt-2 space-y-2 text-sm text-slate-200">{today.sections.find((section) => section.kind === 'objectives')!.items.map((item) => <li key={item.id}>✓ {item.title || item.body}</li>)}</ul></div>}
            {today.sections.find((section) => section.kind === 'exercise')?.items.map((item) => <div key={item.id} className="mt-5 rounded-xl bg-white/5 p-4"><h3 className="text-cyan-200 text-sm font-bold">{t.exercise}</h3><p className="mt-2 text-sm leading-6">{item.body || item.title}</p></div>)}
          </> : <p className="text-slate-200">{guide.days.length ? t.noToday : t.empty}</p>}
          <div className="flex flex-wrap gap-3 mt-6">
            {today && <a href="#full-guide" onClick={() => setSelectedDayId(today.id)} className="rounded-xl bg-cyan-400 text-slate-950 px-4 py-3 text-sm font-bold">{t.view}</a>}
            <button type="button" onClick={() => askIako(today)} className="rounded-xl border border-white/30 px-4 py-3 text-sm font-bold">{t.ask}</button>
            <a href="#my-progress" className="rounded-xl border border-white/30 px-4 py-3 text-sm font-bold">{t.progress}</a>
          </div>
        </section>
        <section id="my-progress" aria-label={t.progress} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 mb-7 scroll-mt-24">
          <div className="flex justify-between gap-3"><h2 className="font-bold">{t.progress}</h2><span className="text-sm">{completedItems} / {totalItems} {t.of}</span></div>
          <progress aria-label={t.progress} value={completedItems} max={Math.max(totalItems, 1)} className="w-full h-2 mt-3 accent-cyan-600" />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{t.progressHelp}</p>
          {progressError && <p role="alert" className="text-sm text-red-600 mt-3">{t.progressError}</p>}
        </section>
        <div id="full-guide" className="scroll-mt-24 min-w-0">
          <nav aria-label={t.guide} className="flex flex-wrap gap-2 mb-5">
            {guide.days.map((day) => <button type="button" key={day.id} onClick={() => setSelectedDayId(day.id)} aria-pressed={day.id === selectedDayId} className={`rounded-xl border px-4 py-2 text-sm ${day.id === selectedDayId ? 'border-cyan-600 bg-cyan-600 text-white' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'}`}>{t.day} {day.dayNumber} <span className="text-xs opacity-70">· {t[day.status]}</span></button>)}
          </nav>
          {selectedDay && <>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-2xl font-black">{t.day} {selectedDay.dayNumber}: {selectedDay.title}</h2>{selectedDay.scheduledDate && <p className="mt-2 text-xs text-slate-500">{t.date}: {selectedDay.scheduledDate.slice(0, 10)}</p>}<p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">{selectedDay.summary}</p></div>
              <button type="button" onClick={() => askIako(selectedDay)} className="shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-bold">{t.askAboutDay(selectedDay.dayNumber)}</button>
            </div>
            <TrainingDayContent day={selectedDay} lang={lang} completedItemIds={selectedDay.completedItemIds} busyItemIds={busyItems} onToggle={(itemId, completed) => void toggleProgress(selectedDay, itemId, completed)} onAsk={(section) => askIako(selectedDay, section)} />
          </>}
        </div>
      </>}
    </main>
  </div>;
}

export default function DailyGuidePage() { return <ProtectedRoute><DailyGuideContent /></ProtectedRoute>; }
