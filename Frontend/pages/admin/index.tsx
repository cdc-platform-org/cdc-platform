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
import {
  clearApplicationCache,
  ClearCacheResult,
  runHealthCheck,
  HealthCheckResult,
  auditOrphanedLocaleKeys,
  OrphanedKeysAuditResult,
} from '../../src/services/adminSystemToolsService';

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

  const [cacheClearing, setCacheClearing] = useState(false);
  const [cacheResult, setCacheResult] = useState<ClearCacheResult | null>(null);
  const [cacheError, setCacheError] = useState<string | null>(null);

  const [healthChecking, setHealthChecking] = useState(false);
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [localeAuditRunning, setLocaleAuditRunning] = useState(false);
  const [localeAuditResult, setLocaleAuditResult] = useState<OrphanedKeysAuditResult | null>(null);
  const [localeAuditError, setLocaleAuditError] = useState<string | null>(null);

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

  const handleClearCache = async () => {
    setCacheClearing(true);
    setCacheError(null);
    setCacheResult(null);
    try {
      setCacheResult(await clearApplicationCache());
    } catch (err: any) {
      setCacheError(err?.response?.data?.message ?? 'Clearing the cache failed.');
    } finally {
      setCacheClearing(false);
    }
  };

  const handleHealthCheck = async () => {
    setHealthChecking(true);
    setHealthError(null);
    setHealthResult(null);
    try {
      setHealthResult(await runHealthCheck());
    } catch (err: any) {
      setHealthError(err?.response?.data?.message ?? 'The health check failed.');
    } finally {
      setHealthChecking(false);
    }
  };

  const handleLocaleAudit = async () => {
    setLocaleAuditRunning(true);
    setLocaleAuditError(null);
    setLocaleAuditResult(null);
    try {
      setLocaleAuditResult(await auditOrphanedLocaleKeys());
    } catch (err: any) {
      setLocaleAuditError(err?.response?.data?.message ?? 'The locale audit failed.');
    } finally {
      setLocaleAuditRunning(false);
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

                {/* TOOL A — Clear & Refresh Application Cache */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 mt-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">🧹 Clear &amp; Refresh Application Cache</p>
                      <p className="text-xs text-gray-500 mt-1 max-w-xl">
                        Clears in-memory response caches instantly — currently just the Course Tutor's cached replies
                        (Blog generation and translations aren't cached anywhere, so there's nothing to clear there).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearCache}
                      disabled={cacheClearing}
                      className="shrink-0 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2.5 rounded-lg border-none cursor-pointer disabled:opacity-60"
                    >
                      {cacheClearing ? 'Clearing…' : '🧹 Clear Cache'}
                    </button>
                  </div>
                  {cacheError && (
                    <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{cacheError}</div>
                  )}
                  {cacheResult && (
                    <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700 space-y-1">
                      {cacheResult.cleared.map((c) => (
                        <p key={c.name}>
                          ✓ {c.name}: {c.entriesCleared} entr{c.entriesCleared === 1 ? 'y' : 'ies'} cleared
                        </p>
                      ))}
                      <p className="text-xs text-gray-400">{cacheResult.note}</p>
                    </div>
                  )}
                </div>

                {/* TOOL B — Global System Health Diagnostic & AI Connectivity Test */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 mt-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">🩺 System Health Diagnostic &amp; AI Connectivity Test</p>
                      <p className="text-xs text-gray-500 mt-1 max-w-xl">
                        Pings Primary Azure OpenAI, Secondary Azure OpenAI, and Gemini directly (never through the
                        automatic failover) so each provider's real status shows independently.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleHealthCheck}
                      disabled={healthChecking}
                      className="shrink-0 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 rounded-lg border-none cursor-pointer disabled:opacity-60"
                    >
                      {healthChecking ? 'Checking…' : '🩺 Run Diagnostic'}
                    </button>
                  </div>
                  {healthError && (
                    <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{healthError}</div>
                  )}
                  {healthResult && (
                    <div className="mt-4 grid sm:grid-cols-3 gap-3">
                      {(
                        [
                          ['Primary Azure OpenAI', healthResult.primaryAzure],
                          ['Secondary Azure OpenAI', healthResult.secondaryAzure],
                          ['Gemini', healthResult.gemini],
                        ] as const
                      ).map(([label, status]) => (
                        <div key={label} className="rounded-lg border border-gray-200 px-3.5 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                !status.configured ? 'bg-gray-300' : status.ok ? 'bg-emerald-500' : 'bg-red-500'
                              }`}
                            />
                            <span className="text-xs font-bold text-gray-900">{label}</span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-1">
                            {!status.configured ? 'Not configured' : status.ok ? `OK — ${status.latencyMs}ms` : status.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* TOOL C — Missing Locales Audit & Cleanup */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 mt-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">🌐 Missing Locales Audit &amp; Cleanup</p>
                      <p className="text-xs text-gray-500 mt-1 max-w-xl">
                        Audits every locale file for orphaned keys — present in a translation but no longer in the
                        en/ reference (stale leftovers from a renamed/removed key). Read-only; review before editing
                        the files by hand.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleLocaleAudit}
                      disabled={localeAuditRunning}
                      className="shrink-0 text-sm font-bold text-white bg-gradient-to-r from-indigo-500 to-blue-600 px-4 py-2.5 rounded-lg border-none cursor-pointer disabled:opacity-60"
                    >
                      {localeAuditRunning ? 'Auditing…' : '🌐 Run Audit'}
                    </button>
                  </div>
                  {localeAuditError && (
                    <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{localeAuditError}</div>
                  )}
                  {localeAuditResult && (
                    <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700">
                      {localeAuditResult.totalOrphanedKeys === 0 ? (
                        <p>✓ No orphaned keys found — every locale file only contains keys present in en/.</p>
                      ) : (
                        <>
                          <p className="font-semibold mb-2">{localeAuditResult.totalOrphanedKeys} orphaned key(s) found:</p>
                          <ul className="space-y-1 text-xs text-gray-600 max-h-64 overflow-y-auto">
                            {localeAuditResult.groups.map((g) => (
                              <li key={`${g.locale}-${g.namespace}`}>
                                <span className="font-mono font-semibold">
                                  {g.locale}/{g.namespace}
                                </span>
                                : {g.orphanedKeys.join(', ')}
                              </li>
                            ))}
                          </ul>
                        </>
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
