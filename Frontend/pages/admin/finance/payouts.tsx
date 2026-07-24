import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AdminGuard from '../../../src/components/admin/AdminGuard';
import AdminLayout from '../../../src/components/admin/AdminLayout';
import {
  getPayoutRequests,
  approvePayoutRequest,
  rejectPayoutRequest,
  markPayoutPaid,
  PayoutRequestRow,
} from '../../../src/services/adminFinanceService';

function formatGel(minorUnits: number): string {
  return `${(minorUnits / 100).toFixed(2)} GEL`;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-sky-50 text-sky-700 border-sky-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function AdminPayoutsDashboard() {
  const [requests, setRequests] = useState<PayoutRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('PENDING');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRequests(await getPayoutRequests(statusFilter || undefined));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (id: string) => {
    if (!window.confirm('Approve this payout? This debits the student\'s wallet balance immediately — you still need to wire the actual bank transfer via BOG.')) return;
    setBusyId(id);
    try {
      const result = await approvePayoutRequest(id);
      alert(result.message);
      load();
    } catch {
      alert('Unable to approve — the balance may no longer cover this request.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id: string) => {
    const note = window.prompt('Reason for rejection (optional):') ?? undefined;
    setBusyId(id);
    try {
      await rejectPayoutRequest(id, note);
      load();
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkPaid = async (id: string) => {
    setBusyId(id);
    try {
      await markPayoutPaid(id);
      load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Head>
        <title>Student Payouts | Admin</title>
      </Head>
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Student Payouts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review and approve withdrawal requests. Approving debits the platform wallet — the actual bank transfer is still sent manually via BOG.
          </p>
        </div>

        <div className="flex items-center gap-2 mb-4">
          {['PENDING', 'APPROVED', 'PAID', 'REJECTED', ''].map((s) => (
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
        ) : requests.length === 0 ? (
          <p className="text-sm text-gray-500">No payout requests here.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">{r.user.name}</span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${STATUS_BADGE[r.status]}`}>{r.status}</span>
                  </div>
                  <p className="text-xs text-gray-500">{r.user.email}</p>
                  <p className="text-xs text-gray-500 mt-1 font-mono">IBAN: {r.iban}</p>
                  <p className="text-xs text-gray-400 mt-1">Requested {new Date(r.createdAt).toLocaleString()}</p>
                  {r.adminNote && <p className="text-xs text-gray-500 mt-1 italic">Note: {r.adminNote}</p>}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xl font-black text-gray-900 mb-2">{formatGel(r.amount)}</div>
                  <div className="flex gap-2 justify-end">
                    {r.status === 'PENDING' && (
                      <>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => handleApprove(r.id)}
                          className="text-xs font-medium text-white bg-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => handleReject(r.id)}
                          className="text-xs font-medium text-red-600 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {r.status === 'APPROVED' && (
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => handleMarkPaid(r.id)}
                        className="text-xs font-medium text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
                      >
                        Mark as Paid
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminPayoutsPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN']}>
      <AdminLayout>
        <AdminPayoutsDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
