import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { getChatFlagIncidents, reviewChatFlagIncident, ChatFlagIncident } from '../../src/services/adminChatModerationService';
import { banUser } from '../../src/services/adminService';

function IncidentRow({ incident, onChanged }: { incident: ChatFlagIncident; onChanged: () => void }) {
  const [acting, setActing] = useState(false);

  const handleBan = async (userId: string) => {
    if (!confirm('Ban this user? They will be immediately signed out of every future request.')) return;
    setActing(true);
    try {
      await banUser(userId, `Chat policy violation (ChatFlag ${incident.id}): ${incident.detectedReason}`);
      onChanged();
    } finally {
      setActing(false);
    }
  };

  const handleReview = async () => {
    setActing(true);
    try {
      await reviewChatFlagIncident(incident.id);
      onChanged();
    } finally {
      setActing(false);
    }
  };

  return (
    <div className={`bg-white border rounded-xl p-4 ${incident.reviewedAt ? 'border-gray-200 opacity-70' : 'border-amber-300'}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">
            {incident.sender.name} ({incident.sender.email}) → {incident.recipient.name} ({incident.recipient.email})
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{new Date(incident.createdAt).toLocaleString()} · {incident.detectedReason}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {incident.reviewedAt ? (
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded border bg-gray-50 text-gray-500 border-gray-200">
              Reviewed by {incident.reviewedByAdmin?.name ?? '—'}
            </span>
          ) : (
            <button
              type="button"
              onClick={handleReview}
              disabled={acting}
              className="text-xs font-medium text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-60"
            >
              Mark Reviewed
            </button>
          )}
          {!incident.sender.isBanned && (
            <button
              type="button"
              onClick={() => handleBan(incident.sender.id)}
              disabled={acting}
              className="text-xs font-medium text-white bg-red-600 px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-60"
            >
              Ban Sender
            </button>
          )}
          {incident.sender.isBanned && (
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded border bg-red-50 text-red-700 border-red-200">Sender Banned</span>
          )}
        </div>
      </div>
      <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-900 whitespace-pre-wrap">
        {incident.attemptedContent}
      </div>
    </div>
  );
}

function AdminChatModerationDashboard() {
  const [incidents, setIncidents] = useState<ChatFlagIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setIncidents(await getChatFlagIncidents(onlyUnreviewed));
    } finally {
      setLoading(false);
    }
  }, [onlyUnreviewed]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Head>
        <title>Chat Moderation | Admin</title>
      </Head>
      <div className="max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Chat Moderation</h1>
          <p className="text-sm text-gray-500 mt-1">
            Blocked direct messages — every attempt to share off-platform contact info or payment terms in a P2P chat is caught before
            delivery, logged here, and never reaches the recipient.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600 mb-4">
          <input type="checkbox" checked={onlyUnreviewed} onChange={(e) => setOnlyUnreviewed(e.target.checked)} />
          Only show unreviewed incidents
        </label>

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : incidents.length === 0 ? (
          <p className="text-sm text-gray-500">No incidents found.</p>
        ) : (
          <div className="space-y-3">
            {incidents.map((incident) => (
              <IncidentRow key={incident.id} incident={incident} onChanged={load} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminChatModerationPage() {
  return (
    <AdminGuard>
      <AdminLayout>
        <AdminChatModerationDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
