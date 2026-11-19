// /admin/marketing-planner — the AI marketing planner: a weekly Facebook /
// Instagram calendar of Georgian posts about store products. Every post is a
// draft until approved here; stage 1 does not post to Meta — the admin copies
// an approved post into Meta Business Suite and marks it published.
// UI pieces: src/components/admin/marketingPlanner/; API:
// src/services/adminMarketingPlannerService.ts; backend:
// Backend/src/services/marketingPlanner/.
import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { CalendarDays, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import PlannerSettingsCard from '../../src/components/admin/marketingPlanner/PlannerSettingsCard';
import PlannerPostCard from '../../src/components/admin/marketingPlanner/PlannerPostCard';
import {
  PlannerOverview,
  PlannerSettings,
  deletePlannerPost,
  editPlannerPost,
  getPlannerOverview,
  movePlannerPost,
  rewritePlannerPost,
  savePlannerSettings,
  startPlanning,
} from '../../src/services/adminMarketingPlannerService';

function errorText(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return message || fallback;
}

const WEEK = 7 * 86_400_000;
const weekLabel = (iso: string) => {
  const opts: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Tbilisi', day: 'numeric', month: 'long' };
  const start = new Date(iso);
  return `${start.toLocaleDateString('ka-GE', opts)} – ${new Date(start.getTime() + WEEK - 1).toLocaleDateString('ka-GE', opts)}`;
};

function MarketingPlannerAdmin() {
  const [week, setWeek] = useState<string | undefined>(undefined);
  const [data, setData] = useState<PlannerOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await getPlannerOverview(week));
      setError(null);
    } catch (err) {
      setError(errorText(err, 'მონაცემები ვერ ჩაიტვირთა.'));
    }
  }, [week]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while the agent is writing the week so drafts appear by themselves.
  const busy = !!data?.status.busy;
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(load, 5_000);
    return () => clearInterval(t);
  }, [busy, load]);

  const act = async (id: string, fn: () => Promise<unknown>, fail: string) => {
    setActingId(id);
    setNotice(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(errorText(err, fail));
    } finally {
      setActingId(null);
    }
  };

  const plan = async () => {
    if (!data) return;
    const hasDrafts = data.posts.some((p) => p.status === 'DRAFT');
    if (hasDrafts && !window.confirm('ამ კვირის დრაფტები ახლით ჩანაცვლდება (დადასტურებულები დარჩება). გავაგრძელო?')) return;
    try {
      await startPlanning(data.week, data.posts.length > 0);
      setNotice('აგენტმა დაიწყო კვირის დაგეგმვა — 1–2 წუთში პოსტები აქ გამოჩნდება.');
      await load();
    } catch (err) {
      setError(errorText(err, 'დაგეგმვა ვერ დაიწყო.'));
    }
  };

  const saveSettings = async (s: PlannerSettings) => {
    await savePlannerSettings(s);
    setNotice('პარამეტრები შენახულია.');
    await load();
  };

  const shiftWeek = (dir: -1 | 1) => data && setWeek(new Date(new Date(data.week).getTime() + dir * WEEK).toISOString());
  const counts = data
    ? (['DRAFT', 'APPROVED', 'PUBLISHED'] as const).map((s) => [s, data.posts.filter((p) => p.status === s).length] as const)
    : [];

  return (
    <>
      <Head>
        <title>AI მარკეტინგის გეგმა | Admin</title>
      </Head>
      <div className="sm:p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-indigo-600" /> AI მარკეტინგის გეგმა
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            აგენტი ირჩევს პროდუქტებს, წერს ქართულ პოსტებს პროდუქტის ლინკით და ანაწილებს კვირაზე. არაფერი ქვეყნდება შენი დადასტურების გარეშე.
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && <p className="text-sm text-emerald-700">{notice}</p>}
        {!data && !error && <p className="text-sm text-gray-400">იტვირთება…</p>}

        {data && (
          <>
            {!data.status.configured && <p className="text-sm text-amber-700">Azure OpenAI არ არის კონფიგურირებული — აგენტი ვერ იმუშავებს.</p>}
            <PlannerSettingsCard settings={data.settings} onSave={saveSettings} />

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <button type="button" className="p-2 rounded-lg border border-gray-300" onClick={() => shiftWeek(-1)} aria-label="წინა კვირა">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold text-gray-900">{weekLabel(data.week)}</span>
                <button type="button" className="p-2 rounded-lg border border-gray-300" onClick={() => shiftWeek(1)} aria-label="შემდეგი კვირა">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="text-xs text-gray-500 ml-2">{counts.map(([s, n]) => `${{ DRAFT: 'დრაფტი', APPROVED: 'დადასტ.', PUBLISHED: 'გამოქვ.' }[s]}: ${n}`).join(' · ')}</span>
              </div>
              <button
                type="button"
                disabled={busy || !data.status.configured}
                onClick={plan}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" /> {busy ? 'აგენტი წერს…' : data.posts.length ? 'კვირის თავიდან დაგეგმვა' : 'კვირის დაგეგმვა'}
              </button>
            </div>
            {data.status.lastError && !busy && <p className="text-sm text-red-600">ბოლო დაგეგმვა ვერ შესრულდა: {data.status.lastError}</p>}

            {data.posts.length === 0 && !busy && <p className="text-sm text-gray-500">ამ კვირაზე პოსტები ჯერ არ არის.</p>}
            <div className="space-y-4">
              {data.posts.map((p) => (
                <PlannerPostCard
                  key={p.id}
                  post={p}
                  busy={actingId === p.id}
                  onSave={(id, patch) => act(id, () => editPlannerPost(id, patch), 'შენახვა ვერ მოხერხდა.')}
                  onRewrite={(id, fb) => act(id, () => rewritePlannerPost(id, fb), 'თავიდან დაწერა ვერ მოხერხდა.')}
                  onMove={(id, action, reason) => act(id, () => movePlannerPost(id, action, reason), 'მოქმედება ვერ შესრულდა.')}
                  onDelete={(id) => act(id, () => deletePlannerPost(id), 'წაშლა ვერ მოხერხდა.')}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default function AdminMarketingPlannerPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout responsive>
        <MarketingPlannerAdmin />
      </AdminLayout>
    </AdminGuard>
  );
}
