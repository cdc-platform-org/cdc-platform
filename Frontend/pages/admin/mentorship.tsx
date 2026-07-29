import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import {
  getMentorshipQueue,
  dismissMentorshipRequest,
  getMentorshipRequests,
  resolveMentorshipRequest,
  MentorshipGig,
  MentorshipHelpRequest,
} from '../../src/services/adminMentorshipService';

function GeneralHelpRequests() {
  const [requests, setRequests] = useState<MentorshipHelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRequests(await getMentorshipRequests());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleResolve = async (id: string) => {
    setBusyId(id);
    try {
      await resolveMentorshipRequest(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mb-10">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">General Help / Mentorship Requests</h2>
        <p className="text-sm text-gray-500 mt-1">
          Submitted via the graduate-only &quot;დახმარება / მენტორობა&quot; button on the student Dashboard.
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-gray-500">No open general help requests.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="font-semibold text-gray-900">{r.user.name}</span>
                <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-xs text-gray-500 mb-3">{r.user.email}</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap mb-3">{r.message}</p>
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => handleResolve(r.id)}
                className="text-xs font-medium text-emerald-600 hover:text-emerald-800 disabled:opacity-60"
              >
                Mark as resolved
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminMentorshipDashboard() {
  const [queue, setQueue] = useState<MentorshipGig[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setQueue(await getMentorshipQueue());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDismiss = async (gigId: string) => {
    setBusyId(gigId);
    try {
      await dismissMentorshipRequest(gigId);
      setQueue((prev) => prev.filter((g) => g.id !== gigId));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Head>
        <title>Mentorship Queue | Admin</title>
      </Head>
      <div className="max-w-4xl">
        <GeneralHelpRequests />

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Mentorship Queue</h1>
          <p className="text-sm text-gray-500 mt-1">Students who requested help, and first-time freelancers flagged for extra support.</p>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : queue.length === 0 ? (
          <p className="text-sm text-gray-500">No open mentor-help requests.</p>
        ) : (
          <div className="space-y-3">
            {queue.map((gig) => (
              <div key={gig.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="font-semibold text-gray-900">{gig.title}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {gig.isFirstOrder && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded border bg-cyan-50 text-cyan-700 border-cyan-200">
                        First Order
                      </span>
                    )}
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">
                      {gig.status}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-1">
                  Freelancer: {gig.assignedFreelancer?.name} ({gig.assignedFreelancer?.email})
                </p>
                <p className="text-xs text-gray-400 mb-3">
                  Requested help {gig.mentorHelpRequestedAt && new Date(gig.mentorHelpRequestedAt).toLocaleString()}
                </p>

                {expandedId === gig.id && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-3 text-sm">
                    <p className="text-gray-700 mb-2">{gig.description}</p>
                    {gig.deliveryComment && (
                      <>
                        <p className="text-xs font-semibold text-gray-500 mt-2">Draft submission:</p>
                        <p className="text-gray-700 whitespace-pre-wrap">{gig.deliveryComment}</p>
                      </>
                    )}
                    {gig.deliveryLinks.map((link) => (
                      <a key={link} href={link} target="_blank" rel="noopener noreferrer" className="block text-xs text-indigo-600 hover:underline mt-1">
                        {link}
                      </a>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === gig.id ? null : gig.id)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    {expandedId === gig.id ? 'Hide details' : 'Inspect draft'}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === gig.id}
                    onClick={() => handleDismiss(gig.id)}
                    className="text-xs font-medium text-gray-500 hover:text-gray-700 disabled:opacity-60"
                  >
                    Mark as handled
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminMentorshipPage() {
  return (
    <AdminGuard>
      <AdminLayout>
        <AdminMentorshipDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
