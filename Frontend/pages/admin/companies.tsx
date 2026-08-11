import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { FileText, ShieldCheck, ShieldAlert, ShieldQuestion, Globe, Sparkles, X } from 'lucide-react';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { getCompanies, verifyCompany, unverifyCompany, rejectCompany, updateAiTrial, CompanyRow } from '../../src/services/adminCompaniesService';
import { useAuth } from '../../src/context/AuthContext';

function formatAiTrialStatus(company: CompanyRow): string {
  if (company.aiSubscriptionActive) return 'Unlimited';
  if (!company.aiTrialEndsAt) return 'No trial yet';
  const endsAt = new Date(company.aiTrialEndsAt);
  const isActive = endsAt.getTime() > Date.now();
  return `${isActive ? 'Active until' : 'Expired'} ${endsAt.toLocaleDateString()}`;
}

function AiTrialModal({ company, onClose, onUpdated }: { company: CompanyRow; onClose: () => void; onUpdated: (c: CompanyRow) => void }) {
  const [saving, setSaving] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const apply = async (payload: Parameters<typeof updateAiTrial>[1]) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateAiTrial(company.id, payload);
      onUpdated({ ...company, aiTrialEndsAt: updated.aiTrialEndsAt, aiSubscriptionActive: updated.aiSubscriptionActive });
    } catch {
      setError('Could not update the trial. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="relative bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-transparent dark:border-white/10 rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-2 cursor-pointer text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center mb-3 shadow-lg shadow-cyan-500/30">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">AI Trial Management</h3>
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">{company.companyName || company.name}</p>

        <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-4">
          Current status: <span className="font-semibold text-gray-900 dark:text-white">{formatAiTrialStatus(company)}</span>
        </p>

        {error && <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3 py-2 text-xs text-red-700 dark:text-red-400">{error}</div>}

        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">Extend from today (or from the current expiry, whichever is later)</p>
        <div className="flex gap-2 mb-4">
          {[7, 14, 30].map((days) => (
            <button
              key={days}
              type="button"
              disabled={saving}
              onClick={() => apply({ mode: 'extend', days })}
              className="flex-1 text-xs font-medium px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60"
            >
              +{days} days
            </button>
          ))}
        </div>

        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">Or set an exact expiration date</p>
        <div className="flex gap-2 mb-4">
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={saving || !customDate}
            onClick={() => apply({ mode: 'set', date: new Date(customDate).toISOString() })}
            className="text-xs font-medium px-3 py-2 rounded-lg bg-gray-800 dark:bg-slate-700 text-white hover:bg-gray-900 dark:hover:bg-slate-600 disabled:opacity-60"
          >
            Set
          </button>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => apply({ mode: 'unlimited' })}
          className="w-full text-xs font-semibold px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:opacity-90 disabled:opacity-60"
        >
          Grant Unlimited Access
        </button>
      </div>
    </div>
  );
}

function deriveStatus(company: CompanyRow): 'unverified' | 'under_review' | 'verified' | 'rejected' {
  if (company.isVerified) return 'verified';
  if (company.verificationStatus === 'REJECTED') return 'rejected';
  if (company.verificationDocUrl) return 'under_review';
  return 'unverified';
}

const STATUS_BADGE: Record<string, string> = {
  verified: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 shadow-emerald-400/30 dark:shadow-emerald-500/20',
  under_review: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20 shadow-amber-400/30 dark:shadow-amber-500/20',
  unverified: 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700 shadow-transparent',
  rejected: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20 shadow-red-400/30 dark:shadow-red-500/20',
};

const STATUS_ICON = { verified: ShieldCheck, under_review: ShieldQuestion, unverified: ShieldAlert, rejected: X };

function AdminCompaniesDashboard() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'' | 'unverified' | 'under_review' | 'verified' | 'rejected'>('under_review');
  const [aiTrialCompanyId, setAiTrialCompanyId] = useState<string | null>(null);
  const { user } = useAuth();
  // Matches the backend's requireAdminRole('SUPER_ADMIN') on PATCH
  // /admin/users/:id/ai-trial — hidden for MANAGER rather than shown as a
  // button that would always 403.
  const canManageAiTrial = user?.adminRole === 'SUPER_ADMIN';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCompanies(await getCompanies(statusFilter || undefined));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleVerify = async (id: string) => {
    setBusyId(id);
    try {
      await verifyCompany(id);
      load();
    } finally {
      setBusyId(null);
    }
  };

  const handleUnverify = async (id: string) => {
    setBusyId(id);
    try {
      await unverifyCompany(id);
      load();
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id: string) => {
    setBusyId(id);
    try {
      await rejectCompany(id);
      load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Head>
        <title>Business Verification | Admin</title>
      </Head>
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Business Verification</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Review uploaded Public Registry Extracts / registration documents and approve or revoke Business accounts.
          </p>
        </div>

        <div className="flex items-center gap-2 mb-4">
          {(['under_review', 'unverified', 'verified', 'rejected', ''] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${statusFilter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900/60 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
            >
              {s === '' ? 'All' : s === 'under_review' ? 'Under Review' : s === 'unverified' ? 'Unverified' : s === 'rejected' ? 'Rejected' : 'Verified'}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 dark:text-slate-500">Loading…</p>
        ) : companies.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">No businesses here.</p>
        ) : (
          <div className="space-y-3">
            {companies.map((c) => {
              const status = deriveStatus(c);
              const StatusIcon = STATUS_ICON[status];
              return (
                <div key={c.id} className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-md border border-gray-200/80 dark:border-white/10 shadow-md shadow-slate-200/40 dark:shadow-none rounded-xl p-5 transition-all duration-300 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900 dark:text-white">{c.companyName || c.name}</span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded border shadow-[0_0_10px_-3px] ${STATUS_BADGE[status]}`}>
                          <StatusIcon className="w-3 h-3" />
                          {status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{c.name} · {c.email}{c.phone ? ` · ${c.phone}` : ''}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                        {c.industry ?? '—'}
                        {c.taxId ? ` · ს/კ ${c.taxId}` : ''} · Registered {new Date(c.createdAt).toLocaleDateString()}
                      </p>
                      {c.websiteUrl && (
                        <a href={c.websiteUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 mt-1">
                          <Globe className="w-3 h-3" />
                          {c.websiteUrl}
                        </a>
                      )}
                      {c.companyDescription && <p className="text-xs text-gray-600 dark:text-slate-300 mt-2">{c.companyDescription}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {c.verificationDocUrl ? (
                        <a
                          href={c.verificationDocUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          View Document
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-slate-500">No document uploaded</span>
                      )}
                      {c.isVerified ? (
                        <button
                          type="button"
                          disabled={busyId === c.id}
                          onClick={() => handleUnverify(c.id)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-60"
                        >
                          Revoke Verification
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={busyId === c.id || !c.verificationDocUrl}
                            onClick={() => handleVerify(c.id)}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busyId === c.id || !c.verificationDocUrl}
                            onClick={() => handleReject(c.id)}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-60"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {canManageAiTrial && (
                        <button
                          type="button"
                          onClick={() => setAiTrialCompanyId(c.id)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          AI Trial: {formatAiTrialStatus(c)}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {aiTrialCompanyId &&
        (() => {
          const company = companies.find((c) => c.id === aiTrialCompanyId);
          if (!company) return null;
          return (
            <AiTrialModal
              company={company}
              onClose={() => setAiTrialCompanyId(null)}
              onUpdated={(updated) => {
                setCompanies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
              }}
            />
          );
        })()}
    </>
  );
}

export default function AdminCompaniesPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AdminCompaniesDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
