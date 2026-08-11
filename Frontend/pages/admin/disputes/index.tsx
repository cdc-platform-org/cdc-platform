import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AdminGuard from '../../../src/components/admin/AdminGuard';
import AdminLayout from '../../../src/components/admin/AdminLayout';
import { getDisputes, DisputeRow } from '../../../src/services/adminDisputesService';

const STATUS_BADGE: Record<string, string> = {
  OPEN: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20 shadow-amber-400/30 dark:shadow-amber-500/20',
  RESOLVED_REFUND: 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20 shadow-purple-400/30 dark:shadow-purple-500/20',
  RESOLVED_PAYOUT: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 shadow-emerald-400/30 dark:shadow-emerald-500/20',
  DISMISSED: 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700 shadow-transparent',
};

function AdminDisputesDashboard() {
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('OPEN');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDisputes(await getDisputes(statusFilter || undefined));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Head>
        <title>Disputes | Admin</title>
      </Head>
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Disputes</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Review incomplete-work disputes and resolve with a refund or payout.</p>
        </div>

        <div className="flex items-center gap-2 mb-4">
          {['OPEN', 'RESOLVED_REFUND', 'RESOLVED_PAYOUT', 'DISMISSED', ''].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${statusFilter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900/60 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 dark:text-slate-500">Loading…</p>
        ) : disputes.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">No disputes here.</p>
        ) : (
          <div className="space-y-3">
            {disputes.map((d) => (
              <Link
                key={d.id}
                href={`/admin/disputes/${d.id}`}
                className="block bg-white/90 dark:bg-slate-900/70 backdrop-blur-md border border-gray-200/80 dark:border-white/10 shadow-md shadow-slate-200/40 dark:shadow-none rounded-xl p-5 no-underline text-current transition-all duration-300 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="font-semibold text-gray-900 dark:text-white">{d.gig.title}</span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border shadow-[0_0_10px_-3px] ${STATUS_BADGE[d.status]}`}>{d.status.replace('_', ' ')}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-slate-300 line-clamp-2 mb-2">{d.reason}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  Raised by {d.raisedBy.name} · {new Date(d.createdAt).toLocaleString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminDisputesPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AdminDisputesDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
