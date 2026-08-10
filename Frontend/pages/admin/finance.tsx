import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import {
  getCoursePayments,
  reverifyCoursePayment,
  refundCoursePayment,
  grantCourseAccess,
  CoursePaymentRow,
} from '../../src/services/adminFinanceService';

function formatGel(minorUnits: number, currency: string): string {
  return `${(minorUnits / 100).toFixed(2)} ${currency}`;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  COMPLETED: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
  FAILED: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20',
  CANCELLED: 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700',
  REFUNDED: 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20',
};

function GrantAccessForm({ onGranted }: { onGranted: () => void }) {
  const [userEmail, setUserEmail] = useState('');
  const [courseId, setCourseId] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      await grantCourseAccess({ userEmail, courseId, note: note || undefined });
      setMessage('✓ Access granted.');
      setUserEmail('');
      setCourseId('');
      setNote('');
      onGranted();
    } catch {
      setMessage('Unable to grant access — check the email and course ID.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-md shadow-slate-200/40 dark:shadow-none rounded-xl p-5 mb-8 transition-colors">
      <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-1">Manual Course Grant</h3>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">For students who paid via bank transfer, outside BOG checkout.</p>
      {message && <div className="mb-3 text-xs text-gray-600 dark:text-slate-300">{message}</div>}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <input
          required
          placeholder="Student email"
          value={userEmail}
          onChange={(e) => setUserEmail(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white px-3 py-2 text-sm"
        />
        <input
          required
          placeholder="Course ID"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white px-3 py-2 text-sm"
        />
        <input
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white px-3 py-2 text-sm"
        />
        <button type="submit" disabled={submitting} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {submitting ? 'Granting…' : 'Grant Access'}
        </button>
      </form>
    </div>
  );
}

const PURPOSE_LABEL: Record<CoursePaymentRow['purpose'], string> = {
  COURSE: 'Course',
  MENTORSHIP: 'Mentorship',
  GIG_ESCROW_FUNDING: 'Gig Escrow',
};

function exportPaymentsCsv(payments: CoursePaymentRow[]) {
  const header = ['Order ID', 'User', 'Email', 'Purpose', 'Reference', 'Amount', 'Currency', 'Status', 'Created At', 'Completed At'];
  const rows = payments.map((p) => [
    p.bogOrderId,
    p.user.name,
    p.user.email,
    PURPOSE_LABEL[p.purpose] ?? p.purpose,
    p.courseTitle,
    (p.amount / 100).toFixed(2),
    p.currency,
    p.status,
    p.createdAt,
    p.completedAt ?? '',
  ]);
  const escapeCsv = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((r) => r.map((v) => escapeCsv(String(v))).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bog-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function AdminFinanceDashboard() {
  const [payments, setPayments] = useState<CoursePaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getCoursePayments({ status: statusFilter || undefined, purpose: purposeFilter || undefined, pageSize: 50 });
      setPayments(result.data);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, purposeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReverify = async (id: string) => {
    setBusyId(id);
    try {
      const updated = await reverifyCoursePayment(id);
      setPayments((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch {
      alert('Re-verification failed — could not reach BOG.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRefund = async (id: string) => {
    if (!window.confirm('Mark as refunded and revoke course access? This does NOT trigger a real bank refund — process that via BOG separately.')) return;
    setBusyId(id);
    try {
      await refundCoursePayment(id);
      load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Head>
        <title>Course Finance | Admin</title>
      </Head>
      <div className="max-w-6xl">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Payment Finance</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 dark:text-slate-400 mt-1">BOG Pay transaction ledger — course sales, mentorship, and gig escrow funding.</p>
          </div>
          <button
            type="button"
            disabled={payments.length === 0}
            onClick={() => exportPaymentsCsv(payments)}
            className="text-xs font-medium px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
          >
            Export CSV
          </button>
        </div>

        <GrantAccessForm onGranted={load} />

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {['', 'PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${statusFilter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900/60 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700'}`}
            >
              {s || 'All statuses'}
            </button>
          ))}
          <span className="w-px h-5 bg-gray-200 dark:bg-slate-700 mx-1" />
          {(['', 'COURSE', 'MENTORSHIP', 'GIG_ESCROW_FUNDING'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPurposeFilter(p)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${purposeFilter === p ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900/60 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700'}`}
            >
              {p ? PURPOSE_LABEL[p] : 'All purposes'}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 dark:text-slate-500">Loading…</p>
        ) : payments.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">No transactions found.</p>
        ) : (
          <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-md shadow-slate-200/40 dark:shadow-none rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/60">
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Purpose</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 dark:border-slate-800 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-slate-400 max-w-[140px] truncate">{p.bogOrderId}</td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900 dark:text-white">{p.user.name}</div>
                      <div className="text-xs text-gray-400 dark:text-slate-500">{p.user.email}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400">{PURPOSE_LABEL[p.purpose] ?? p.purpose}</td>
                    <td className="px-4 py-3 max-w-[180px] truncate">{p.courseTitle}</td>
                    <td className="px-4 py-3 font-semibold">{formatGel(p.amount, p.currency)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${STATUS_BADGE[p.status]}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {p.status === 'PENDING' && (
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            onClick={() => handleReverify(p.id)}
                            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 disabled:opacity-60"
                          >
                            Re-verify
                          </button>
                        )}
                        {p.status === 'COMPLETED' && p.purpose === 'COURSE' && (
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            onClick={() => handleRefund(p.id)}
                            className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-60"
                          >
                            Refund & Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminFinancePage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN']}>
      <AdminLayout>
        <AdminFinanceDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
