import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { FileText, ShieldCheck, ShieldAlert, ShieldQuestion, Globe, Sparkles, X, Search, Users, Lock, Unlock } from 'lucide-react';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import {
  getCompanies,
  verifyCompany,
  unverifyCompany,
  rejectCompany,
  updateAiTrial,
  getTaxIdLimit,
  setTaxIdLimit,
  resetTaxIdLimit,
  CompanyRow,
} from '../../src/services/adminCompaniesService';
import { useAuth } from '../../src/context/AuthContext';

// Inline "how many accounts may share this ს/კ" control — fetches the
// current override (or platform default) only when opened, since most
// companies never need this touched at all.
function TaxIdLimitControl({ taxId }: { taxId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [maxAccounts, setMaxAccounts] = useState<number | null>(null);
  const [isDefault, setIsDefault] = useState(true);
  const [accountCount, setAccountCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [input, setInput] = useState('');

  const load = () => {
    setLoading(true);
    getTaxIdLimit(taxId)
      .then((data) => {
        setMaxAccounts(data.maxAccounts);
        setIsDefault(data.isDefault);
        setAccountCount(data.accountCount);
        setInput(data.maxAccounts?.toString() ?? '');
      })
      .finally(() => setLoading(false));
  };

  const toggle = () => {
    if (!open) load();
    setOpen((v) => !v);
  };

  const handleSetLimit = async () => {
    setSaving(true);
    try {
      const parsed = input.trim() === '' ? null : parseInt(input, 10);
      await setTaxIdLimit(taxId, Number.isFinite(parsed) ? parsed : null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      await resetTaxIdLimit(taxId);
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400"
      >
        {isDefault ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
        ს/კ ლიმიტი
      </button>
      {open && (
        <div className="mt-1.5 p-2.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60 w-56">
          {loading ? (
            <p className="text-[11px] text-gray-400">იტვირთება…</p>
          ) : (
            <>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mb-1.5">
                ამჟამად {accountCount} ანგარიში ამ ს/კ-ზე · ლიმიტი: {maxAccounts ?? (isDefault ? '3 (ნაგულისხმევი)' : 'ულიმიტო')}
              </p>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  placeholder="რაოდ."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="w-16 rounded border border-gray-300 dark:border-slate-600 dark:bg-slate-900 px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={handleSetLimit}
                  disabled={saving}
                  className="text-[11px] font-bold px-2 py-1 rounded bg-indigo-600 text-white disabled:opacity-50"
                >
                  შენახვა
                </button>
                {!isDefault && (
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={saving}
                    className="text-[11px] font-bold px-2 py-1 rounded border border-gray-300 dark:border-slate-600 disabled:opacity-50"
                  >
                    ნაგულისხმევზე დაბრუნება
                  </button>
                )}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">ცარიელი = ულიმიტო</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const ACTIVE_STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
  LIQUIDATION: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20',
  INSOLVENCY: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20',
  RESTRAINED: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  UNKNOWN: 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700',
};

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 85
      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
      : score >= 50
        ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
        : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20';
  return (
    <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full border ${tone}`}>
      AI Confidence: {score}%
    </span>
  );
}

// Extracted-vs-entered comparison row — flags a mismatch visually rather
// than making the admin eyeball two free-text values side by side.
function CompareRow({ label, extracted, entered }: { label: string; extracted: string; entered: string }) {
  const mismatch = extracted.trim().toLowerCase() !== entered.trim().toLowerCase() && extracted !== '—' && entered !== '—';
  return (
    <div className="grid grid-cols-3 gap-2 py-2 border-b border-gray-100 dark:border-slate-800 last:border-0">
      <span className="text-xs font-medium text-gray-500 dark:text-slate-400">{label}</span>
      <span className={`text-xs ${mismatch ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-900 dark:text-white'}`}>{extracted}</span>
      <span className="text-xs text-gray-600 dark:text-slate-300">{entered}</span>
    </div>
  );
}

function KycInspectionDrawer({
  company,
  onClose,
  onApprove,
  onReject,
  busy,
}: {
  company: CompanyRow;
  onClose: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
  busy: boolean;
}) {
  const [reasonDraft, setReasonDraft] = useState('');
  const extracted = company.businessKycExtractedData;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-end z-50" onClick={onClose}>
      <div
        className="h-full w-full max-w-lg bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-white/10 overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">{company.companyName || company.name}</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{company.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 cursor-pointer text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {company.verificationDocUrl ? (
          <a
            href={company.verificationDocUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline mb-5 rounded-lg border border-gray-200 dark:border-slate-700 px-3.5 py-2.5"
          >
            <FileText className="w-4 h-4" />
            Open uploaded document
          </a>
        ) : (
          <p className="text-sm text-gray-400 dark:text-slate-500 mb-5">No document uploaded yet.</p>
        )}

        {extracted ? (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <ScoreBadge score={company.businessKycScore ?? extracted.confidenceScore} />
              <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full border ${ACTIVE_STATUS_BADGE[extracted.activeStatus]}`}>
                {extracted.activeStatus}
              </span>
              {extracted.hasOfficialHeaders ? (
                <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300">
                  Official headers detected
                </span>
              ) : (
                <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10">
                  No official headers detected
                </span>
              )}
            </div>

            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-2">Extracted vs. entered</h4>
            <div className="rounded-lg border border-gray-200 dark:border-slate-700 px-3.5 py-1 mb-4">
              <div className="grid grid-cols-3 gap-2 py-2 border-b border-gray-100 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-gray-400 dark:text-slate-500">Field</span>
                <span className="text-[10px] font-bold uppercase text-gray-400 dark:text-slate-500">AI extracted</span>
                <span className="text-[10px] font-bold uppercase text-gray-400 dark:text-slate-500">User entered</span>
              </div>
              <CompareRow label="Company name" extracted={extracted.companyName ?? '—'} entered={company.companyName ?? '—'} />
              <CompareRow label="Tax/ID code" extracted={extracted.identificationCode ?? '—'} entered={company.taxId ?? '—'} />
              <div className="grid grid-cols-3 gap-2 py-2">
                <span className="text-xs font-medium text-gray-500 dark:text-slate-400">Registered</span>
                <span className="text-xs text-gray-900 dark:text-white">{extracted.registrationDate ?? '—'}</span>
                <span className="text-xs text-gray-600 dark:text-slate-300">{extracted.registryAuthority ?? '—'}</span>
              </div>
            </div>

            {extracted.directors.length > 0 && (
              <>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Directors / representatives
                </h4>
                <ul className="mb-4 space-y-1">
                  {extracted.directors.map((d, i) => (
                    <li key={i} className="text-xs text-gray-700 dark:text-slate-300">
                      {d.name}
                      {d.personalId ? ` · ${d.personalId}` : ''}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-2">AI reasoning</h4>
            <p className="text-xs text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-800/60 rounded-lg p-3 mb-5">{extracted.reasoning}</p>
          </>
        ) : (
          <p className="text-sm text-gray-400 dark:text-slate-500 mb-5">
            No AI parse on file yet — either Gemini isn't configured, or this document hasn't been analyzed.
          </p>
        )}

        {company.businessKycRejectionReason && (
          <div className="mb-5 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3.5 py-2.5">
            <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-0.5">Last rejection reason</p>
            <p className="text-xs text-red-600 dark:text-red-300">{company.businessKycRejectionReason}</p>
          </div>
        )}

        <div className="border-t border-gray-200 dark:border-slate-800 pt-5 space-y-3">
          <button
            type="button"
            disabled={busy}
            onClick={onApprove}
            className="w-full text-sm font-semibold px-4 py-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Approve — Grant Buy/Sell Access
          </button>
          <textarea
            value={reasonDraft}
            onChange={(e) => setReasonDraft(e.target.value)}
            rows={2}
            placeholder="Rejection reason (sent to the business by email + in-app)"
            className="w-full rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <button
            type="button"
            disabled={busy || !reasonDraft.trim()}
            onClick={() => onReject(reasonDraft.trim())}
            className="w-full text-sm font-semibold px-4 py-2.5 rounded-lg border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-60"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const [inspectingCompanyId, setInspectingCompanyId] = useState<string | null>(null);
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
      setInspectingCompanyId(null);
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

  const handleReject = async (id: string, reason: string) => {
    setBusyId(id);
    try {
      await rejectCompany(id, reason);
      setInspectingCompanyId(null);
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
                      {c.taxId && <TaxIdLimitControl taxId={c.taxId} />}
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
                      <div className="flex items-center gap-1.5">
                        {c.businessKycScore !== null && <ScoreBadge score={c.businessKycScore} />}
                        <button
                          type="button"
                          onClick={() => setInspectingCompanyId(c.id)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
                        >
                          <Search className="w-3.5 h-3.5" />
                          Inspect
                        </button>
                      </div>
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
                        <button
                          type="button"
                          disabled={busyId === c.id || !c.verificationDocUrl}
                          onClick={() => handleVerify(c.id)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          Approve
                        </button>
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

      {inspectingCompanyId &&
        (() => {
          const company = companies.find((c) => c.id === inspectingCompanyId);
          if (!company) return null;
          return (
            <KycInspectionDrawer
              company={company}
              busy={busyId === company.id}
              onClose={() => setInspectingCompanyId(null)}
              onApprove={() => handleVerify(company.id)}
              onReject={(reason) => handleReject(company.id, reason)}
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
