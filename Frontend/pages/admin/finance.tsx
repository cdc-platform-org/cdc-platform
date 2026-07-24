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
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
  CANCELLED: 'bg-gray-100 text-gray-500 border-gray-200',
  REFUNDED: 'bg-purple-50 text-purple-700 border-purple-200',
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
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
      <h3 className="font-semibold text-sm text-gray-900 mb-1">Manual Course Grant</h3>
      <p className="text-xs text-gray-500 mb-4">For students who paid via bank transfer, outside BOG checkout.</p>
      {message && <div className="mb-3 text-xs text-gray-600">{message}</div>}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <input
          required
          placeholder="Student email"
          value={userEmail}
          onChange={(e) => setUserEmail(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          required
          placeholder="Course ID"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button type="submit" disabled={submitting} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {submitting ? 'Granting…' : 'Grant Access'}
        </button>
      </form>
    </div>
  );
}

function AdminFinanceDashboard() {
  const [payments, setPayments] = useState<CoursePaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getCoursePayments({ status: statusFilter || undefined, pageSize: 50 });
      setPayments(result.data);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

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
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Course Finance</h1>
          <p className="text-sm text-gray-500 mt-1">BOG Pay transaction ledger for course sales.</p>
        </div>

        <GrantAccessForm onGranted={load} />

        <div className="flex items-center gap-2 mb-4">
          {['', 'PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'].map((s) => (
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
        ) : payments.length === 0 ? (
          <p className="text-sm text-gray-500">No transactions found.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-[140px] truncate">{p.bogOrderId}</td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{p.user.name}</div>
                      <div className="text-xs text-gray-400">{p.user.email}</div>
                    </td>
                    <td className="px-4 py-3 max-w-[180px] truncate">{p.courseTitle}</td>
                    <td className="px-4 py-3 font-semibold">{formatGel(p.amount, p.currency)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${STATUS_BADGE[p.status]}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {p.status === 'PENDING' && (
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            onClick={() => handleReverify(p.id)}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-60"
                          >
                            Re-verify
                          </button>
                        )}
                        {p.status === 'COMPLETED' && (
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            onClick={() => handleRefund(p.id)}
                            className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-60"
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
