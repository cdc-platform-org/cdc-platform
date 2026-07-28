import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { FileText, ShieldCheck, ShieldAlert, ShieldQuestion, Globe } from 'lucide-react';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { getCompanies, verifyCompany, unverifyCompany, CompanyRow } from '../../src/services/adminCompaniesService';

function deriveStatus(company: CompanyRow): 'unverified' | 'under_review' | 'verified' {
  if (company.isVerified) return 'verified';
  if (company.verificationDocUrl) return 'under_review';
  return 'unverified';
}

const STATUS_BADGE: Record<string, string> = {
  verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  under_review: 'bg-amber-50 text-amber-700 border-amber-200',
  unverified: 'bg-gray-100 text-gray-500 border-gray-200',
};

const STATUS_ICON = { verified: ShieldCheck, under_review: ShieldQuestion, unverified: ShieldAlert };

function AdminCompaniesDashboard() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'' | 'unverified' | 'under_review' | 'verified'>('under_review');

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

  return (
    <>
      <Head>
        <title>Business Verification | Admin</title>
      </Head>
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Business Verification</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review uploaded Public Registry Extracts / registration documents and approve or revoke Business accounts.
          </p>
        </div>

        <div className="flex items-center gap-2 mb-4">
          {(['under_review', 'unverified', 'verified', ''] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${statusFilter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'}`}
            >
              {s === '' ? 'All' : s === 'under_review' ? 'Under Review' : s === 'unverified' ? 'Unverified' : 'Verified'}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : companies.length === 0 ? (
          <p className="text-sm text-gray-500">No businesses here.</p>
        ) : (
          <div className="space-y-3">
            {companies.map((c) => {
              const status = deriveStatus(c);
              const StatusIcon = STATUS_ICON[status];
              return (
                <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{c.companyName || c.name}</span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${STATUS_BADGE[status]}`}>
                          <StatusIcon className="w-3 h-3" />
                          {status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{c.name} · {c.email}{c.phone ? ` · ${c.phone}` : ''}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {c.industry ?? '—'}
                        {c.taxId ? ` · ს/კ ${c.taxId}` : ''} · Registered {new Date(c.createdAt).toLocaleDateString()}
                      </p>
                      {c.websiteUrl && (
                        <a href={c.websiteUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1 mt-1">
                          <Globe className="w-3 h-3" />
                          {c.websiteUrl}
                        </a>
                      )}
                      {c.companyDescription && <p className="text-xs text-gray-600 mt-2">{c.companyDescription}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {c.verificationDocUrl ? (
                        <a
                          href={c.verificationDocUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          View Document
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">No document uploaded</span>
                      )}
                      {c.isVerified ? (
                        <button
                          type="button"
                          disabled={busyId === c.id}
                          onClick={() => handleUnverify(c.id)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60"
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

export default function AdminCompaniesPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AdminCompaniesDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
