import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AdminGuard from '../../../src/components/admin/AdminGuard';
import AdminLayout from '../../../src/components/admin/AdminLayout';
import { getDisputes, DisputeRow } from '../../../src/services/adminDisputesService';

const STATUS_BADGE: Record<string, string> = {
  OPEN: 'bg-amber-50 text-amber-700 border-amber-200',
  RESOLVED_REFUND: 'bg-purple-50 text-purple-700 border-purple-200',
  RESOLVED_PAYOUT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DISMISSED: 'bg-gray-100 text-gray-500 border-gray-200',
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
          <h1 className="text-2xl font-semibold text-gray-900">Disputes</h1>
          <p className="text-sm text-gray-500 mt-1">Review incomplete-work disputes and resolve with a refund or payout.</p>
        </div>

        <div className="flex items-center gap-2 mb-4">
          {['OPEN', 'RESOLVED_REFUND', 'RESOLVED_PAYOUT', 'DISMISSED', ''].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${statusFilter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'}`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : disputes.length === 0 ? (
          <p className="text-sm text-gray-500">No disputes here.</p>
        ) : (
          <div className="space-y-3">
            {disputes.map((d) => (
              <Link
                key={d.id}
                href={`/admin/disputes/${d.id}`}
                className="block bg-white border border-gray-200 rounded-xl p-5 no-underline text-current hover:border-indigo-300 transition-colors"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="font-semibold text-gray-900">{d.gig.title}</span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${STATUS_BADGE[d.status]}`}>{d.status.replace('_', ' ')}</span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2 mb-2">{d.reason}</p>
                <p className="text-xs text-gray-400">
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
