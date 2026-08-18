import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { getCandidateVerifications, CandidateVerificationRow } from '../../src/services/adminExamProctoringService';

const STATUS_BADGE: Record<string, string> = {
  IN_PROGRESS: 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-500/20 shadow-cyan-400/30 dark:shadow-cyan-500/20',
  COMPLETED: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 shadow-emerald-400/30 dark:shadow-emerald-500/20',
  FLAGGED: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20 shadow-rose-400/30 dark:shadow-rose-500/20',
};

function integrityColor(score: number | null): string {
  if (score == null) return 'text-gray-400 dark:text-slate-500';
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function AdminCandidateVerificationsDashboard() {
  const [rows, setRows] = useState<CandidateVerificationRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getCandidateVerifications(statusFilter || undefined);
      setRows(result.data);
      setCounts(result.counts);
    } catch {
      setError('Unable to load candidate verifications.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <>
      <Head>
        <title>Candidate Verifications | Admin</title>
      </Head>
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Candidate Verifications</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Every AI-proctored exam submission across every business — integrity score and violation counts are
            computed server-side from logged proctoring events, not from anything the candidate's browser reports at
            submit time.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="flex items-center gap-2 mb-4">
          {['', 'FLAGGED', 'COMPLETED', 'IN_PROGRESS'].map((s) => (
            <button
              key={s || 'ALL'}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${statusFilter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900/60 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
            >
              {s || 'All'} {s ? `(${counts[s] ?? 0})` : `(${totalCount})`}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 dark:text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">No submissions here.</p>
        ) : (
          <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl border border-gray-200/80 dark:border-white/10 shadow-md shadow-slate-200/40 dark:shadow-none overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-slate-400 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/60">
                    <th className="px-4 py-3 font-medium">Candidate</th>
                    <th className="px-4 py-3 font-medium">Exam</th>
                    <th className="px-4 py-3 font-medium">Business</th>
                    <th className="px-4 py-3 font-medium text-right">Score</th>
                    <th className="px-4 py-3 font-medium text-right">Integrity</th>
                    <th className="px-4 py-3 font-medium text-right">Violations</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Started</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-gray-900 dark:text-white font-medium">{r.candidateName}</div>
                        <div className="text-xs text-gray-400 dark:text-slate-500">{r.candidateEmail}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-slate-300 max-w-[220px] truncate">{r.examSession.title}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs">{r.examSession.business.name}</td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                        {r.totalScore != null ? `${r.totalScore}%` : <span className="text-gray-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${integrityColor(r.integrityScore)}`}>
                        {r.integrityScore != null ? r.integrityScore : <span className="text-gray-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 dark:text-slate-400 text-xs">
                        {r.proctoringViolations} <span className="text-gray-300 dark:text-slate-600">({r.tabSwitches} tab / {r.copyPasteCount} paste)</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border shadow-[0_0_10px_-3px] ${STATUS_BADGE[r.status]}`}>
                          {r.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs whitespace-nowrap">
                        {new Date(r.startedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminCandidateVerificationsPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AdminCandidateVerificationsDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
