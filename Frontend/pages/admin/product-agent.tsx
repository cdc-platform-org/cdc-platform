// /admin/product-agent — the AI product agent: settings and cost, the
// products it created (approve / edit / delete) and its run history.
// UI pieces: src/components/admin/productAgent/; API:
// src/services/adminProductAgentService.ts; backend:
// Backend/src/services/productAgent/.
import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { Bot } from 'lucide-react';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import AgentSettingsCard from '../../src/components/admin/productAgent/AgentSettingsCard';
import AgentProductsList from '../../src/components/admin/productAgent/AgentProductsList';
import AgentRunsTable from '../../src/components/admin/productAgent/AgentRunsTable';
import {
  AgentCategoryKey,
  ProductAgentOverview,
  ProductAgentSettings,
  deleteAgentProduct,
  getProductAgentOverview,
  runProductAgent,
  updateProductAgentSettings,
} from '../../src/services/adminProductAgentService';
import { approveProduct } from '../../src/services/productService';

function errorText(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return message || fallback;
}

function ProductAgentAdmin() {
  const [data, setData] = useState<ProductAgentOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await getProductAgentOverview());
      setError(null);
    } catch (err) {
      setError(errorText(err, 'მონაცემები ვერ ჩაიტვირთა.'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh while something is queued or running so new products appear
  // without reloading the page.
  const active = !!data && (data.busy || data.runs.some((r) => r.status === 'QUEUED' || r.status === 'RUNNING'));
  useEffect(() => {
    if (!active) return;
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [active, load]);

  const save = async (s: ProductAgentSettings) => {
    await updateProductAgentSettings(s);
    setNotice('პარამეტრები შენახულია.');
    await load();
  };

  const run = async (keys: AgentCategoryKey[]) => {
    try {
      await runProductAgent(keys);
      setNotice(`გაშვებულია: ${keys.length} პროდუქტი. თითოს 2–10 წუთი სჭირდება — სია თავისით განახლდება.`);
      await load();
    } catch (err) {
      setError(errorText(err, 'აგენტი ვერ გაეშვა.'));
    }
  };

  const approve = async (id: string) => {
    setActingId(id);
    try {
      await approveProduct(id);
      await load();
    } catch (err) {
      setError(errorText(err, 'დამტკიცება ვერ მოხერხდა.'));
    } finally {
      setActingId(null);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('წავშალო ეს პროდუქტი? ამას ვეღარ დააბრუნებ.')) return;
    setActingId(id);
    try {
      await deleteAgentProduct(id);
      await load();
    } catch (err) {
      setError(errorText(err, 'წაშლა ვერ მოხერხდა.'));
    } finally {
      setActingId(null);
    }
  };

  return (
    <>
      <Head>
        <title>AI პროდუქტების აგენტი | Admin</title>
      </Head>
      <div className="p-6 max-w-6xl mx-auto space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bot className="w-6 h-6 text-indigo-600" /> AI პროდუქტების აგენტი
            </h1>
            <p className="text-sm text-gray-500 mt-1">ქმნის ციფრულ პროდუქტებს მაღაზიისთვის. ყველა ახალი პროდუქტი ჯერ დამტკიცებას ელოდება.</p>
          </div>
          {data && (
            <div className="flex gap-3 text-sm">
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                <div className="text-xs text-gray-500">დღეს დაიხარჯა</div>
                <div className="font-semibold">${data.spend.todayUsd.toFixed(2)}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                <div className="text-xs text-gray-500">ამ თვეში</div>
                <div className="font-semibold">
                  ${data.spend.monthUsd.toFixed(2)} / ${data.settings.monthlyBudgetUsd} · {data.spend.monthProducts} პროდ.
                </div>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && <p className="text-sm text-emerald-700">{notice}</p>}
        {!data && !error && <p className="text-sm text-gray-400">იტვირთება…</p>}

        {data && (
          <>
            <AgentSettingsCard settings={data.settings} categories={data.categories} busy={data.busy} configured={data.configured} onSave={save} onRun={run} />
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">აგენტის შექმნილი პროდუქტები</h2>
              <AgentProductsList products={data.products} actingId={actingId} onApprove={approve} onDelete={remove} />
            </section>
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">გაშვებების ისტორია</h2>
              <AgentRunsTable runs={data.runs} categories={data.categories} />
            </section>
          </>
        )}
      </div>
    </>
  );
}

export default function AdminProductAgentPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <ProductAgentAdmin />
      </AdminLayout>
    </AdminGuard>
  );
}
