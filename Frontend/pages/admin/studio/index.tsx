import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AdminGuard from '../../../src/components/admin/AdminGuard';
import AdminLayout from '../../../src/components/admin/AdminLayout';
import { getStudioInquiries, updateStudioInquiry } from '../../../src/services/studioService';
import { StudioInquiry, StudioInquiryStatus } from '../../../src/types/studio';

const STATUS_BADGE: Record<StudioInquiryStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  IN_REVIEW: 'bg-sky-50 text-sky-700 border-sky-200',
  ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DECLINED: 'bg-red-50 text-red-700 border-red-200',
};

function AdminStudioDashboard() {
  const [inquiries, setInquiries] = useState<StudioInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setInquiries(await getStudioInquiries(statusFilter || undefined));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async (id: string, status: StudioInquiryStatus) => {
    setBusyId(id);
    try {
      await updateStudioInquiry(id, { status });
      load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Head>
        <title>CDC Studio Inquiries | Admin</title>
      </Head>
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">CDC Studio Inquiries</h1>
          <p className="text-sm text-gray-500 mt-1">Leads submitted via the "Request a Project" form on /agency.</p>
        </div>

        <div className="flex items-center gap-2 mb-4">
          {['PENDING', 'IN_REVIEW', 'ACCEPTED', 'DECLINED', ''].map((s) => (
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
        ) : inquiries.length === 0 ? (
          <p className="text-sm text-gray-500">No inquiries here.</p>
        ) : (
          <div className="space-y-3">
            {inquiries.map((inq) => (
              <div key={inq.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{inq.name}</span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${STATUS_BADGE[inq.status]}`}>{inq.status}</span>
                    </div>
                    <p className="text-xs text-gray-500">{inq.email}{inq.phone ? ` · ${inq.phone}` : ''}{inq.company ? ` · ${inq.company}` : ''}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {inq.projectType}{inq.budgetRange ? ` · Budget: ${inq.budgetRange}` : ''} · {new Date(inq.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {(['IN_REVIEW', 'ACCEPTED', 'DECLINED'] as StudioInquiryStatus[])
                      .filter((s) => s !== inq.status)
                      .map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={busyId === inq.id}
                          onClick={() => handleStatusChange(inq.id, s)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                        >
                          {s.replace('_', ' ')}
                        </button>
                      ))}
                  </div>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{inq.message}</p>
                {inq.reviewedBy && (
                  <p className="text-[11px] text-gray-400 mt-2">
                    Reviewed by {inq.reviewedBy.name}{inq.resolvedAt ? ` on ${new Date(inq.resolvedAt).toLocaleDateString()}` : ''}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminStudioPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AdminStudioDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
