// Individual (person) submissions in the single employer-verification queue
// on /admin/companies — company submissions are rendered by that page
// itself. Approve/reject go to /api/admin/individual-verifications.
import { useCallback, useEffect, useState } from 'react';
import { FileText, User } from 'lucide-react';
import {
  IndividualVerificationRow,
  approveIndividual,
  getIndividualVerifications,
  rejectIndividual,
  resolveIndividualDocument,
} from '../../services/adminIndividualVerificationService';
import { adminLocale, at, atEnum } from '../../i18n/admin';

type QueueStatus = '' | 'unverified' | 'under_review' | 'verified' | 'rejected';

// The company tabs map onto the individual statuses; "unverified" has no
// individual equivalent (an individual only appears once they submit).
const STATUS_MAP: Record<QueueStatus, 'PENDING' | 'APPROVED' | 'REJECTED' | undefined | null> = {
  '': undefined,
  under_review: 'PENDING',
  verified: 'APPROVED',
  rejected: 'REJECTED',
  unverified: null,
};

export default function IndividualVerificationList({ status }: { status: QueueStatus }) {
  const [rows, setRows] = useState<IndividualVerificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const mapped = STATUS_MAP[status];
    if (mapped === null) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRows(await getIndividualVerifications(mapped));
    } catch {
      setError(at('Could not load individual verifications.'));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, fn: () => Promise<IndividualVerificationRow>) => {
    setBusyId(id);
    setError(null);
    try {
      const updated = await fn();
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
    } catch {
      setError(at('Action failed. Please try again.'));
    } finally {
      setBusyId(null);
    }
  };

  const openDoc = async (id: string) => {
    try {
      window.open(await resolveIndividualDocument(id), '_blank', 'noopener,noreferrer');
    } catch {
      setError(at('Could not open this document. Please try again.'));
    }
  };

  if (loading) return <p className="text-sm text-gray-400">{at('Loading…')}</p>;
  if (!rows.length) return <p className="text-sm text-gray-500">{at('No individual submissions here.')}</p>;

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {rows.map((r) => (
        <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <User className="w-4 h-4 text-indigo-500" /> {r.name}
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded border bg-indigo-50 text-indigo-700 border-indigo-200">{at('Individual')}</span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded border bg-gray-50 text-gray-600 border-gray-200">{atEnum(r.verificationStatus)}</span>
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {r.email}
              {r.nationalId ? ` · ${at('Personal ID')}: ${r.nationalId}` : ''} · {new Date(r.createdAt).toLocaleDateString(adminLocale())}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {r.verificationDocUrl && (
              <button type="button" onClick={() => void openDoc(r.id)} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> {at('View Document')}
              </button>
            )}
            {r.verificationStatus !== 'APPROVED' && (
              <button type="button" disabled={busyId === r.id} onClick={() => void act(r.id, () => approveIndividual(r.id))} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60">
                {at('Approve')}
              </button>
            )}
            {r.verificationStatus === 'PENDING' && (
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => {
                  const reason = window.prompt(at('Rejection reason (sent to the person):'))?.trim();
                  if (reason) void act(r.id, () => rejectIndividual(r.id, reason));
                }}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                {at('Reject')}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
