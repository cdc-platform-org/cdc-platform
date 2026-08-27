import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import StatCard from '../../src/components/admin/StatCard';
import { useAuth } from '../../src/context/AuthContext';
import { DashboardStats } from '../../src/types/adminPanel';
import { getDashboardStats } from '../../src/services/adminPanelService';
import { runI18nAutoTranslateAgent, I18nAgentRunResult } from '../../src/services/adminI18nService';

function formatMoney(minorUnits: number): string {
  return `${(minorUnits / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GEL`;
}

function DashboardOverview() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [i18nAgentRunning, setI18nAgentRunning] = useState(false);
  const [i18nAgentResult, setI18nAgentResult] = useState<I18nAgentRunResult | null>(null);
  const [i18nAgentError, setI18nAgentError] = useState<string | null>(null);

  const handleRunI18nAgent = async () => {
    setI18nAgentRunning(true);
    setI18nAgentError(null);
    setI18nAgentResult(null);
    try {
      setI18nAgentResult(await runI18nAutoTranslateAgent());
    } catch (err: any) {
      setI18nAgentError(err?.response?.data?.message ?? 'The translation agent run failed.');
    } finally {
      setI18nAgentRunning(false);
    }
  };

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch {
      setError('Unable to load dashboard stats. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return (
    <>
      <Head>
        <title>Dashboard Overview | Admin</title>
      </Head>
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard Overview</h1>
          <p className="text-sm text-gray-500 mt-1">
            Welcome back, {user?.name}. Here's what's happening on the platform.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : stats ? (
          <div className="space-y-8">
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Users</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Users" value={stats.users.total} icon="👥" accent="cyan" />
                <StatCard
                  label="Pending Approval"
                  value={stats.users.pendingApproval}
                  icon="⏳"
                  accent="amber"
                />
                <StatCard label="Students" value={stats.users.students} icon="🎓" accent="purple" />
                <StatCard label="Banned" value={stats.users.banned} icon="🚫" accent="rose" />
              </div>
            </section>

            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Gigs & Vacancies</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Active Gigs" value={stats.gigs.active} icon="💼" accent="emerald" />
                <StatCard label="Total Gigs" value={stats.gigs.total} icon="📋" accent="cyan" />
                <StatCard label="Total Vacancies" value={stats.vacancies.total} icon="🏢" accent="purple" />
                <StatCard
                  label="Clients"
                  value={stats.users.clients}
                  icon="🏬"
                  accent="amber"
                />
              </div>
            </section>

            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Platform Volume</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  label="Total Gross Volume"
                  value={formatMoney(stats.volume.totalGrossAmount)}
                  icon="💰"
                  accent="emerald"
                  sublabel={`${stats.volume.transactionCount} transaction${stats.volume.transactionCount !== 1 ? 's' : ''}`}
                />
                <StatCard
                  label="Platform Commission"
                  value={formatMoney(stats.volume.totalCommissionAmount)}
                  icon="📈"
                  accent="cyan"
                />
                <StatCard
                  label="Net Paid to Freelancers"
                  value={formatMoney(stats.volume.totalNetAmount)}
                  icon="🤝"
                  accent="purple"
                />
              </div>
            </section>

            {/* Day-to-day ops queue — the three things someone running the
                pilot needs to check without hunting through five separate
                pages: escrow disputes waiting on a decision, freelancer
                payouts waiting on approval, and candidate exam submissions
                (including how many were flagged for proctoring violations
                in the last week — the number that matters most to a B2B
                partner asking "can I trust this screening?"). */}
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Needs Attention</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link href="/admin/disputes" className="no-underline text-current">
                  <StatCard label="Open Disputes" value={stats.disputes.open} icon="⚖️" accent="rose" />
                </Link>
                <Link href="/admin/finance/payouts" className="no-underline text-current">
                  <StatCard label="Pending Payouts" value={stats.payouts.pending} icon="🏦" accent="amber" />
                </Link>
                <Link href="/admin/candidate-verifications" className="no-underline text-current">
                  <StatCard
                    label="Flagged Candidates (7d)"
                    value={stats.examProctoring.flaggedLast7Days}
                    icon="🛡️"
                    accent="rose"
                    sublabel={`${stats.examProctoring.total} total submissions`}
                  />
                </Link>
              </div>
            </section>

            {user?.adminRole === 'SUPER_ADMIN' && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">System Tools</h2>
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">🤖 Scan &amp; Auto-Translate All Locales</p>
                      <p className="text-xs text-gray-500 mt-1 max-w-xl">
                        Scans public/locales/*/*.json for keys missing (or empty) vs. en/, drafts translations via
                        Gemini, and commits the patch to a new local git branch for you to review — it never pushes
                        or touches main directly.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRunI18nAgent}
                      disabled={i18nAgentRunning}
                      className="shrink-0 text-sm font-bold text-white bg-gradient-to-r from-purple-500 to-cyan-600 px-4 py-2.5 rounded-lg border-none cursor-pointer disabled:opacity-60"
                    >
                      {i18nAgentRunning ? 'Scanning…' : '🤖 Scan & Auto-Translate All Locales'}
                    </button>
                  </div>

                  {i18nAgentError && (
                    <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{i18nAgentError}</div>
                  )}

                  {i18nAgentResult && (
                    <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700 space-y-2">
                      <p className="font-semibold">{i18nAgentResult.message}</p>
                      {i18nAgentResult.patchedGroups.length > 0 && (
                        <ul className="list-disc list-inside text-xs text-gray-600">
                          {i18nAgentResult.patchedGroups.map((g) => (
                            <li key={`${g.locale}-${g.namespace}`}>
                              {g.locale}/{g.namespace}: {g.keysPatched} key{g.keysPatched === 1 ? '' : 's'}
                            </li>
                          ))}
                        </ul>
                      )}
                      {i18nAgentResult.skippedNonStringKeys.length > 0 && (
                        <p className="text-xs text-amber-700">
                          {i18nAgentResult.skippedNonStringKeys.length} key(s) need manual review (non-string values the agent never auto-translates).
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}

export default function AdminDashboardPage() {
  return (
    <AdminGuard>
      <AdminLayout>
        <DashboardOverview />
      </AdminLayout>
    </AdminGuard>
  );
}
