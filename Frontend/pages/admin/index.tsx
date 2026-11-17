import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import StatCard from '../../src/components/admin/StatCard';
import Toast from '../../src/components/shared/Toast';
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
  purgeSystemJunk,
} from '../../src/services/adminSystemToolsService';

import { adminLocale, at, atf } from '../../src/i18n/admin';
function formatMoney(minorUnits: number): string {
  return `${(minorUnits / 100).toLocaleString(adminLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GEL`;
}

// Every System Tools handler below used to fall back to the exact same
// generic text ("Clearing the cache failed", "The health check failed"...)
// whenever `err.response.data.message` was missing — which happens for two
// very different reasons that look identical to an admin staring at a red
// banner: (1) the request reached the Backend and it returned a real error
// (a specific, actionable message IS available, just one property deeper —
// this path was already handled correctly), or (2) the request never got a
// response at all (a network failure, a CORS rejection, a timeout — axios
// gives no `.response` object in this case). Case 2 is what a browser-wide
// issue (e.g. a misconfigured CORS allowlist) looks like from here, and it
// would hit every single tool on this page simultaneously with the same
// unhelpful fallback text — indistinguishable from 5 independent bugs
// without opening the network tab. Surfacing which case actually happened
// turns that into a one-glance diagnosis.
function describeToolError(err: any, fallback: string): string {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.response) return atf("Server returned an unexpected error (HTTP {0}).", err.response.status);
  if (err?.request) return at("Request never reached the server — this usually means a network or CORS problem, not a bug in this specific tool.");
  return fallback;
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

  const [junkPurging, setJunkPurging] = useState(false);
  const [junkError, setJunkError] = useState<string | null>(null);
  const [junkToast, setJunkToast] = useState<string | null>(null);

  const handleRunI18nAgent = async () => {
    setI18nAgentRunning(true);
    setI18nAgentError(null);
    setI18nAgentResult(null);
    try {
      setI18nAgentResult(await runI18nAutoTranslateAgent());
    } catch (err: any) {
      setI18nAgentError(describeToolError(err, at('The translation agent run failed.')));
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
      setCacheError(describeToolError(err, at('Clearing the cache failed.')));
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
      setHealthError(describeToolError(err, at('The health check failed.')));
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
      setLocaleAuditError(describeToolError(err, at('The locale audit failed.')));
    } finally {
      setLocaleAuditRunning(false);
    }
  };

  const handlePurgeJunk = async () => {
    setJunkPurging(true);
    setJunkError(null);
    try {
      const result = await purgeSystemJunk();
      setJunkToast(`🧹 ${result.message}`);
    } catch (err: any) {
      setJunkError(describeToolError(err, at('Purging system junk failed.')));
    } finally {
      setJunkPurging(false);
    }
  };

  useEffect(() => {
    if (!junkToast) return;
    const timer = setTimeout(() => setJunkToast(null), 6000);
    return () => clearTimeout(timer);
  }, [junkToast]);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch {
      setError(at("Unable to load dashboard stats. Please try again."));
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
        <title>{at("Dashboard Overview | Admin")}</title>
      </Head>
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">{at("Dashboard Overview")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {at("Welcome back,")}{" "}{user?.name}{at(". Here's what's happening on the platform.")}
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-400">{at("Loading…")}</p>
        ) : stats ? (
          <div className="space-y-8">
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">{at("Users")}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label={at("Total Users")} value={stats.users.total} icon="👥" accent="cyan" />
                <StatCard
                  label={at("Pending Approval")}
                  value={stats.users.pendingApproval}
                  icon="⏳"
                  accent="amber"
                />
                <StatCard label={at("Students")} value={stats.users.students} icon="🎓" accent="purple" />
                <StatCard label={at("Banned")} value={stats.users.banned} icon="🚫" accent="rose" />
              </div>
            </section>

            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">{at("Gigs & Vacancies")}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label={at("Active Gigs")} value={stats.gigs.active} icon="💼" accent="emerald" />
                <StatCard label={at("Total Gigs")} value={stats.gigs.total} icon="📋" accent="cyan" />
                <StatCard label={at("Total Vacancies")} value={stats.vacancies.total} icon="🏢" accent="purple" />
                <StatCard
                  label={at("Clients")}
                  value={stats.users.clients}
                  icon="🏬"
                  accent="amber"
                />
              </div>
            </section>

            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">{at("Platform Volume")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  label={at("Total Gross Volume")}
                  value={formatMoney(stats.volume.totalGrossAmount)}
                  icon="💰"
                  accent="emerald"
                  sublabel={atf("{0} transaction{1}", stats.volume.transactionCount, stats.volume.transactionCount !== 1 ? 's' : '')}
                />
                <StatCard
                  label={at("Platform Commission")}
                  value={formatMoney(stats.volume.totalCommissionAmount)}
                  icon="📈"
                  accent="cyan"
                />
                <StatCard
                  label={at("Net Paid to Freelancers")}
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
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">{at("Needs Attention")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link href="/admin/disputes" className="no-underline text-current">
                  <StatCard label={at("Open Disputes")} value={stats.disputes.open} icon="⚖️" accent="rose" />
                </Link>
                <Link href="/admin/finance/payouts" className="no-underline text-current">
                  <StatCard label={at("Pending Payouts")} value={stats.payouts.pending} icon="🏦" accent="amber" />
                </Link>
                <Link href="/admin/candidate-verifications" className="no-underline text-current">
                  <StatCard
                    label={at("Flagged Candidates (7d)")}
                    value={stats.examProctoring.flaggedLast7Days}
                    icon="🛡️"
                    accent="rose"
                    sublabel={atf("{0} total submissions", stats.examProctoring.total)}
                  />
                </Link>
              </div>
            </section>

            {user?.adminRole === 'SUPER_ADMIN' && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">{at("System Tools")}</h2>
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{at("🤖 Scan & Auto-Translate All Locales")}</p>
                      <p className="text-xs text-gray-500 mt-1 max-w-xl">
                        {at("Scans public/locales/*/*.json for keys missing (or empty) vs. en/, drafts translations via Gemini, and commits the patch to a new local git branch for you to review — it never pushes or touches main directly.")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRunI18nAgent}
                      disabled={i18nAgentRunning}
                      className="shrink-0 text-sm font-bold text-white bg-gradient-to-r from-purple-500 to-cyan-600 px-4 py-2.5 rounded-lg border-none cursor-pointer disabled:opacity-60"
                    >
                      {i18nAgentRunning ? at("Scanning…") : at("🤖 Scan & Auto-Translate All Locales")}
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
                          {i18nAgentResult.skippedNonStringKeys.length} {at("key(s) need manual review (non-string values the agent never auto-translates).")}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* TOOL A — Clear & Refresh Application Cache */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 mt-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{at("🧹 Clear & Refresh Application Cache")}</p>
                      <p className="text-xs text-gray-500 mt-1 max-w-xl">
                        {at("Clears in-memory response caches instantly — currently just the Course Tutor's cached replies (Blog generation and translations aren't cached anywhere, so there's nothing to clear there).")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearCache}
                      disabled={cacheClearing}
                      className="shrink-0 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2.5 rounded-lg border-none cursor-pointer disabled:opacity-60"
                    >
                      {cacheClearing ? at("Clearing…") : at("🧹 Clear Cache")}
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
                      <p className="text-sm font-semibold text-gray-900">{at("🩺 System Health Diagnostic & AI Connectivity Test")}</p>
                      <p className="text-xs text-gray-500 mt-1 max-w-xl">
                        {at("Pings Primary Azure OpenAI, Secondary Azure OpenAI, and Gemini directly (never through the automatic failover) so each provider's real status shows independently.")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleHealthCheck}
                      disabled={healthChecking}
                      className="shrink-0 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 rounded-lg border-none cursor-pointer disabled:opacity-60"
                    >
                      {healthChecking ? at("Checking…") : at("🩺 Run Diagnostic")}
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
                            {!status.configured ? at("Not configured") : status.ok ? atf("OK — {0}ms", status.latencyMs) : status.message}
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
                      <p className="text-sm font-semibold text-gray-900">{at("🌐 Missing Locales Audit & Cleanup")}</p>
                      <p className="text-xs text-gray-500 mt-1 max-w-xl">
                        {at("Audits every locale file for orphaned keys — present in a translation but no longer in the en/ reference (stale leftovers from a renamed/removed key). Read-only; review before editing the files by hand.")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleLocaleAudit}
                      disabled={localeAuditRunning}
                      className="shrink-0 text-sm font-bold text-white bg-gradient-to-r from-indigo-500 to-blue-600 px-4 py-2.5 rounded-lg border-none cursor-pointer disabled:opacity-60"
                    >
                      {localeAuditRunning ? at("Auditing…") : at("🌐 Run Audit")}
                    </button>
                  </div>
                  {localeAuditError && (
                    <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{localeAuditError}</div>
                  )}
                  {localeAuditResult && (
                    <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700">
                      {localeAuditResult.totalOrphanedKeys === 0 ? (
                        <p>{at("✓ No orphaned keys found — every locale file only contains keys present in en/.")}</p>
                      ) : (
                        <>
                          <p className="font-semibold mb-2">{localeAuditResult.totalOrphanedKeys} {at("orphaned key(s) found:")}</p>
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

                {/* TOOL D — System Junk & Temp Cleanup */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 mt-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{at("🧹 Purge Temporary Junk & Cache")}</p>
                      <p className="text-xs text-gray-500 mt-1 max-w-xl">
                        {at("Cleans temporary runtime cache, leftover log files, and OS junk to optimize server performance. Never touches .env files, the database, or uploaded user assets.")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handlePurgeJunk}
                      disabled={junkPurging}
                      className="shrink-0 text-sm font-bold text-white bg-gradient-to-r from-slate-600 to-slate-800 px-4 py-2.5 rounded-lg border-none cursor-pointer disabled:opacity-60"
                    >
                      {junkPurging ? at("Purging…") : at("🧹 Purge System Junk")}
                    </button>
                  </div>
                  {junkError && (
                    <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{junkError}</div>
                  )}
                </div>
              </section>
            )}
          </div>
        ) : null}

        {junkToast && <Toast message={junkToast} />}
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
