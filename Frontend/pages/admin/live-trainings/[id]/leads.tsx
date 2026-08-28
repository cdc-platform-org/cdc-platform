import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { ChevronLeft, Download } from 'lucide-react';
import AdminGuard from '../../../../src/components/admin/AdminGuard';
import AdminLayout from '../../../../src/components/admin/AdminLayout';
import { LiveTraining, LiveTrainingLead, LiveTrainingLeadStatus, LiveTrainingEnrollment } from '../../../../src/types/liveTraining';
import { getLiveTraining } from '../../../../src/services/liveTrainingService';
import {
  getLiveTrainingLeads,
  updateLiveTrainingLead,
  exportLiveTrainingLeadsCsv,
  getLiveTrainingEnrollments,
} from '../../../../src/services/adminLiveTrainingService';

const STATUS_LABEL: Record<LiveTrainingLeadStatus, string> = {
  NOT_CONTACTED: 'დაუკავშირებელი',
  CONTACTED: 'დაკავშირებული',
  SCHEDULED: 'დაგეგმილი',
  DECLINED: 'უარი განაცხადა',
};

const STATUS_BADGE: Record<LiveTrainingLeadStatus, string> = {
  NOT_CONTACTED: 'bg-gray-100 text-gray-600 border-gray-200',
  CONTACTED: 'bg-amber-50 text-amber-700 border-amber-200',
  SCHEDULED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DECLINED: 'bg-red-50 text-red-700 border-red-200',
};

function AdminLiveTrainingLeadsDashboard() {
  const router = useRouter();
  const trainingId = typeof router.query.id === 'string' ? router.query.id : null;

  const [training, setTraining] = useState<LiveTraining | null>(null);
  const [leads, setLeads] = useState<LiveTrainingLead[]>([]);
  const [enrollments, setEnrollments] = useState<LiveTrainingEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<LiveTrainingLeadStatus | ''>('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!trainingId) return;
    setLoading(true);
    setError(null);
    try {
      const [t, l, e] = await Promise.all([
        getLiveTraining(trainingId),
        getLiveTrainingLeads(trainingId),
        getLiveTrainingEnrollments(trainingId),
      ]);
      setTraining(t);
      setLeads(l);
      setEnrollments(e.filter((row) => row.status === 'ACTIVE'));
    } catch {
      setError('მონაცემების ჩატვირთვა ვერ მოხერხდა.');
    } finally {
      setLoading(false);
    }
  }, [trainingId]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredLeads = useMemo(() => (statusFilter ? leads.filter((l) => l.status === statusFilter) : leads), [leads, statusFilter]);

  const handleStatusChange = async (leadId: string, status: LiveTrainingLeadStatus) => {
    setBusyId(leadId);
    try {
      const updated = await updateLiveTrainingLead(leadId, { status });
      setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
    } catch {
      setError('სტატუსის განახლება ვერ მოხერხდა.');
    } finally {
      setBusyId(null);
    }
  };

  const handleExport = async () => {
    if (!trainingId) return;
    setExporting(true);
    try {
      const blob = await exportLiveTrainingLeadsCsv(trainingId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${training?.title ?? 'live-training'}-leads.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('CSV ექსპორტი ვერ მოხერხდა.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Head>
        <title>{training ? `${training.title} — ლიდები` : 'ლიდები'} | Admin</title>
      </Head>
      <div className="max-w-5xl">
        <Link href="/admin/live-trainings" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 mb-4">
          <ChevronLeft className="w-3.5 h-3.5" /> ტრენინგებზე დაბრუნება
        </Link>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="blog-heading-safe text-2xl font-semibold text-gray-900">{training?.title ?? 'ლიდები'}</h1>
            {training && (
              <p className="text-sm text-gray-500 mt-1">
                {new Date(training.scheduledAt).toLocaleString()} · {training.registeredCount} / {training.maxCapacity} რეგისტრირებული ·{' '}
                {training.minThresholdMet
                  ? 'მინ. ჯგუფი შევსებულია'
                  : `მინ. ${training.minCapacity}-კაციან ჯგუფს აკლია ${Math.max(0, training.minCapacity - training.registeredCount)} ადამიანი`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || leads.length === 0}
            className="shrink-0 flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'იტვირთება…' : 'CSV ექსპორტი'}
          </button>
        </div>

        {!loading && enrollments.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-8">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-900">ჩარიცხული სტუდენტები — რეალური ანგარიშები ({enrollments.length})</h2>
              <p className="text-xs text-gray-500 mt-0.5">ეს არის კოჰორტის რეალური სია — მათ დაშბორდზე ავტომატურად უჩნდებათ მიერთების ბმული და ჩანაწერი.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 font-medium">სახელი</th>
                    <th className="px-4 py-3 font-medium">ელ. ფოსტა</th>
                    <th className="px-4 py-3 font-medium">ჩარიცხვის დრო</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {enrollments.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{e.user.name}</td>
                      <td className="px-4 py-3 text-gray-600">{e.user.email}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(e.enrolledAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <h2 className="text-sm font-semibold text-gray-900 mb-3">ანონიმური ლიდები — სატელეფონო კონტაქტის რიგი</h2>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {(['', 'NOT_CONTACTED', 'CONTACTED', 'SCHEDULED', 'DECLINED'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                statusFilter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {s === '' ? 'ყველა' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {error && <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : filteredLeads.length === 0 ? (
          <p className="text-sm text-gray-500">ლიდები ვერ მოიძებნა.</p>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 font-medium">სახელი</th>
                    <th className="px-4 py-3 font-medium">კონტაქტი</th>
                    <th className="px-4 py-3 font-medium">რეგისტრაცია</th>
                    <th className="px-4 py-3 font-medium">სტატუსი</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredLeads.map((l) => (
                    <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{l.name}</td>
                      <td className="px-4 py-3 text-gray-600">
                        <div>{l.email}</div>
                        <a href={`tel:${l.phone.replace(/\s+/g, '')}`} className="text-indigo-600 hover:underline">
                          {l.phone}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(l.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <select
                          value={l.status}
                          disabled={busyId === l.id}
                          onChange={(e) => handleStatusChange(l.id, e.target.value as LiveTrainingLeadStatus)}
                          className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border cursor-pointer disabled:opacity-60 ${STATUS_BADGE[l.status]}`}
                        >
                          {(Object.keys(STATUS_LABEL) as LiveTrainingLeadStatus[]).map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
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

export default function AdminLiveTrainingLeadsPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AdminLiveTrainingLeadsDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
