import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import AdminGuard from '../../../src/components/admin/AdminGuard';
import AdminLayout from '../../../src/components/admin/AdminLayout';
import { getDispute, resolveDispute, DisputeDetail } from '../../../src/services/adminDisputesService';

function formatGel(minorUnits: number, currency: string): string {
  return `${(minorUnits / 100).toFixed(2)} ${currency}`;
}

function AdminDisputeDetail() {
  const router = useRouter();
  const disputeId = typeof router.query.id === 'string' ? router.query.id : null;
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolving, setResolving] = useState(false);

  const load = useCallback(async () => {
    if (!disputeId) return;
    setLoading(true);
    try {
      setDispute(await getDispute(disputeId));
    } finally {
      setLoading(false);
    }
  }, [disputeId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleResolve = async (status: 'RESOLVED_REFUND' | 'RESOLVED_PAYOUT' | 'DISMISSED') => {
    if (!disputeId) return;
    const labels = { RESOLVED_REFUND: 'refund the client', RESOLVED_PAYOUT: 'release payout to the freelancer', DISMISSED: 'dismiss this dispute' };
    if (!window.confirm(`Resolve this dispute by choosing to ${labels[status]}?`)) return;
    setResolving(true);
    try {
      await resolveDispute(disputeId, status, resolutionNote || undefined);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Unable to resolve this dispute.');
    } finally {
      setResolving(false);
    }
  };

  if (loading || !dispute) {
    return <p className="text-sm text-gray-400">Loading…</p>;
  }

  return (
    <>
      <Head>
        <title>Dispute — {dispute.gig.title} | Admin</title>
      </Head>
      <div className="max-w-3xl">
        <Link href="/admin/disputes" className="text-sm text-gray-500 hover:text-gray-700">
          ← All disputes
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 mt-3 mb-1">{dispute.gig.title}</h1>
        <p className="text-sm text-gray-500 mb-6">
          Raised by {dispute.raisedBy.name} ({dispute.raisedBy.email}) · {new Date(dispute.createdAt).toLocaleString()}
        </p>

        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-sm text-gray-900 mb-2">Reason</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{dispute.reason}</p>
        </div>

        {dispute.gig.deliveryComment && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
            <h3 className="font-semibold text-sm text-gray-900 mb-2">Submitted Work</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{dispute.gig.deliveryComment}</p>
            {dispute.gig.deliveryLinks.map((link) => (
              <a key={link} href={link} target="_blank" rel="noopener noreferrer" className="block text-xs text-indigo-600 hover:underline">
                {link}
              </a>
            ))}
          </div>
        )}

        {dispute.gig.transaction && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
            <h3 className="font-semibold text-sm text-gray-900 mb-2">Escrow</h3>
            <p className="text-sm text-gray-700">
              {formatGel(dispute.gig.transaction.grossAmount, dispute.gig.transaction.currency)} held —{' '}
              <span className="font-medium">{dispute.gig.transaction.status}</span>
            </p>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-sm text-gray-900 mb-3">Chat History (client ↔ freelancer)</h3>
          {dispute.messages.length === 0 ? (
            <p className="text-sm text-gray-400">No messages between these two users.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {dispute.messages.map((m) => (
                <div key={m.id} className="text-sm border-b border-gray-100 pb-2 last:border-0">
                  <p className="text-xs text-gray-400">{new Date(m.createdAt).toLocaleString()}{m.wasFiltered && ' · ⚠ content filtered'}</p>
                  <p className="text-gray-700">{m.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {dispute.status === 'OPEN' ? (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">Resolve</h3>
            <textarea
              rows={3}
              placeholder="Resolution note (optional)"
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-3"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={resolving}
                onClick={() => handleResolve('RESOLVED_PAYOUT')}
                className="text-sm font-medium text-white bg-emerald-600 px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-60"
              >
                Release Payout to Freelancer
              </button>
              <button
                type="button"
                disabled={resolving}
                onClick={() => handleResolve('RESOLVED_REFUND')}
                className="text-sm font-medium text-white bg-purple-600 px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-60"
              >
                Refund Client
              </button>
              <button
                type="button"
                disabled={resolving}
                onClick={() => handleResolve('DISMISSED')}
                className="text-sm font-medium text-gray-600 bg-gray-100 px-4 py-2 rounded-lg hover:bg-gray-200 disabled:opacity-60"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-sm text-gray-700">
              Resolved: <span className="font-semibold">{dispute.status.replace('_', ' ')}</span>
              {dispute.resolvedBy && ` by ${dispute.resolvedBy.name}`}
            </p>
            {dispute.resolution && <p className="text-sm text-gray-500 mt-1">{dispute.resolution}</p>}
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminDisputeDetailPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AdminDisputeDetail />
      </AdminLayout>
    </AdminGuard>
  );
}
