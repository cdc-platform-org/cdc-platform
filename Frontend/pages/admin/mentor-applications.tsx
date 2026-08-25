import { useState, useEffect, useCallback } from 'react';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { getMentorApplications, approveMentorApplication, rejectMentorApplication } from '../../src/services/adminMentorApplicationService';
import { MentorApplication, MentorApplicationStatus } from '../../src/types/instructor';

const STATUS_TABS: (MentorApplicationStatus | '')[] = ['PENDING', 'APPROVED', 'REJECTED', ''];
const STATUS_LABEL: Record<MentorApplicationStatus | '', string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  '': 'All',
};
const STATUS_BADGE: Record<MentorApplicationStatus, string> = {
  PENDING: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/30',
  APPROVED: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/30',
  REJECTED: 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-500/10 dark:border-red-500/30',
};

function ApplicationCard({
  application,
  onApprove,
  onReject,
}: {
  application: MentorApplication;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}) {
  const [acting, setActing] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{application.user?.name}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">{application.user?.email}</p>
        </div>
        <span className={`inline-flex items-center text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${STATUS_BADGE[application.status]}`}>
          {application.status}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 text-xs">
        <div>
          <p className="font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Background</p>
          <p className="text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{application.background}</p>
        </div>
        <div>
          <p className="font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Bio</p>
          <p className="text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{application.bio}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap text-xs">
        {application.teachingTopics.map((topic) => (
          <span key={topic} className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30">
            {topic}
          </span>
        ))}
        {application.linkedinUrl && (
          <a href={application.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">
            LinkedIn ↗
          </a>
        )}
      </div>

      {application.status === 'REJECTED' && application.rejectionReason && (
        <p className="text-xs text-red-600 dark:text-red-400">Rejection reason: {application.rejectionReason}</p>
      )}

      {application.status === 'PENDING' && (
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
          <button
            type="button"
            disabled={acting}
            onClick={async () => {
              setActing(true);
              await onApprove(application.id);
              setActing(false);
            }}
            className="text-xs font-medium text-white bg-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-60"
          >
            Approve — Grant Mentor Role
          </button>
          <button
            type="button"
            disabled={acting}
            onClick={async () => {
              setActing(true);
              await onReject(application.id);
              setActing(false);
            }}
            className="text-xs font-medium text-white bg-red-600 px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-60"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

function AdminMentorApplicationsDashboard() {
  const [status, setStatus] = useState<MentorApplicationStatus | ''>('PENDING');
  const [applications, setApplications] = useState<MentorApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setApplications(await getMentorApplications(status));
    setLoading(false);
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (id: string) => {
    const updated = await approveMentorApplication(id);
    setApplications((prev) => (status === '' ? prev.map((a) => (a.id === id ? updated : a)) : prev.filter((a) => a.id !== id)));
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt('Rejection reason (shown to the applicant):');
    if (!reason || reason.trim().length < 5) return;
    const updated = await rejectMentorApplication(id, reason.trim());
    setApplications((prev) => (status === '' ? prev.map((a) => (a.id === id ? updated : a)) : prev.filter((a) => a.id !== id)));
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Mentor Applications</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">Review self-serve applications to become a Mentor / course instructor.</p>
      </div>

      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-slate-800 pb-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab || 'all'}
            type="button"
            onClick={() => setStatus(tab)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
              status === tab
                ? 'bg-gray-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            {STATUS_LABEL[tab]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">Loading…</p>
      ) : applications.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">No applications here.</p>
      ) : (
        <div className="space-y-3">
          {applications.map((application) => (
            <ApplicationCard key={application.id} application={application} onApprove={handleApprove} onReject={handleReject} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminMentorApplicationsPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AdminMentorApplicationsDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
