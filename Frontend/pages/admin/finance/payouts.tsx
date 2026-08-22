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
  PROCESSING: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

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
          {['PENDING', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'REJECTED', ''].map((s) => (
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
            {requests.map((r) => {
              // Same OR condition the risk engine's own enforcement is
              // built on (see bogPayoutService.processAutoApprovedPayouts —
              // it only ever touches riskTier=LOW rows): today, with the
              // auto-approval sweep not yet cron-wired, this flags nearly
              // every request, since none has actually been auto-approved
              // yet. That's expected, not a bug — it becomes a genuinely
              // selective signal once the sweep runs regularly.
              const isFlagged = !r.autoApproved || r.riskTier === 'MANUAL_REVIEW';
              const usualIp = r.user.loginEvents[0]?.ip ?? null;
              const ipMismatch = usualIp !== null && r.requestIp !== null && usualIp !== r.requestIp;

              return (
                <div
                  key={r.id}
                  className={`bg-white border rounded-xl p-5 ${isFlagged ? 'border-red-300 ring-1 ring-red-100' : 'border-gray-200'}`}
                >
                  {isFlagged && (
                    <div className="mb-3 -mt-1 -mx-1 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <p className="text-xs font-bold text-red-700 uppercase tracking-wide">⚠ Manual review required</p>
                      {r.riskReasons.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {r.riskReasons.map((reason, i) => (
                            <li key={i} className="text-xs text-red-700">
                              • {reason}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{r.user.name}</span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${STATUS_BADGE[r.status]}`}>{r.status}</span>
                        {isFlagged && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded border bg-red-100 text-red-700 border-red-300">
                            Red flag
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{r.user.email}</p>
                      <p className="text-xs text-gray-500 mt-1 font-mono">IBAN: {r.iban}</p>
                      <p className="text-xs text-gray-400 mt-1">Requested {formatDateTime(r.createdAt)}</p>
                      {r.adminNote && <p className="text-xs text-gray-500 mt-1 italic">Note: {r.adminNote}</p>}

                      <div className="mt-2 pt-2 border-t border-gray-100 space-y-0.5">
                        <p className={`text-xs font-mono ${ipMismatch ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                          Request IP: {r.requestIp ?? 'unknown'}
                          {usualIp && <span className="text-gray-400 font-sans"> · usual IP: {usualIp}</span>}
                        </p>
                        <p className="text-xs text-gray-500">
                          IBAN last changed:{' '}
                          {r.user.payoutIbanUpdatedAt ? formatDateTime(r.user.payoutIbanUpdatedAt) : 'never (or predates tracking)'}
                        </p>
                      </div>
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
                </div>
              );
            })}
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
