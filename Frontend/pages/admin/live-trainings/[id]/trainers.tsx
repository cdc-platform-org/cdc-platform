import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import AdminGuard from '@/src/components/admin/AdminGuard';
import AdminLayout from '@/src/components/admin/AdminLayout';
import {
  getAdminTrainers,
  getTrainingTrainerAssignments,
  assignTrainerToTraining,
  removeTrainerAssignment,
  AdminTrainerProfile,
  AdminTrainerAssignment,
} from '@/src/services/adminTrainerService';

// ============================================================
// IAKO Trainer Tools — per-training trainer assignment (Phase 1).
// SUPER_ADMIN/MANAGER only. Same parent-resolved shape as the
// sibling enrollments.tsx/guides.tsx pages; the actual API guard
// lives in Backend's adminLiveTrainingTrainers.ts.
// ============================================================

function TrainerAssignmentsContent() {
  const router = useRouter();
  const trainingId = typeof router.query.id === 'string' ? router.query.id : '';
  const [assignments, setAssignments] = useState<AdminTrainerAssignment[]>([]);
  const [roster, setRoster] = useState<AdminTrainerProfile[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!trainingId) return;
    setLoading(true);
    setError(null);
    try {
      const [assignmentsData, rosterData] = await Promise.all([
        getTrainingTrainerAssignments(trainingId),
        getAdminTrainers(),
      ]);
      setAssignments(assignmentsData);
        setRoster(rosterData.filter((profile) => profile.active));
      setSelectedId((current) => rosterData.some((profile) => profile.id === current) ? current : (rosterData.find((profile) => profile.active)?.id ?? ''));
    } catch {
      setError('Unable to load trainer assignments.');
    } finally {
      setLoading(false);
    }
  }, [trainingId]);

  useEffect(() => { void load(); }, [load]);

  const handleAssign = async () => {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      await assignTrainerToTraining(trainingId, selectedId);
      await load();
    } catch (err: unknown) {
      const apiMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(apiMessage ?? 'Unable to assign this trainer.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (assignmentId: string) => {
    setBusy(true);
    setError(null);
    try {
      await removeTrainerAssignment(trainingId, assignmentId);
      await load();
    } catch {
      setError('Unable to remove this assignment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Link href="/admin/live-trainings" className="text-xs text-cyan-700">← ტრენინგები</Link>
      <h1 className="text-2xl font-semibold text-gray-900 mt-3">ტრენერები ამ ტრენინგზე</h1>
      <p className="text-sm text-gray-500 mt-1">ერთ ტრენინგზე რამდენიმე ტრენერის მინიჭებაა შესაძლებელი. გაუმეორებელი მინიჭება — სერვერი ბლოკავს დუბლიკატს.</p>

      {error && <div role="alert" className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="mt-5 flex gap-2 items-center flex-wrap">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-72"
        >
          <option value="">აირჩიეთ ტრენერი…</option>
          {roster.map((profile) => (
            <option key={profile.id} value={profile.id}>{profile.user.name} ({profile.user.email})</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void handleAssign()}
          disabled={busy || !selectedId}
          className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          მინიჭება
        </button>
      </div>

      <div className="mt-6 space-y-2">
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : assignments.length === 0 ? (
          <p className="text-sm text-gray-500">ამ ტრენინგზე ტრენერი ჯერ არ არის მინიჭებული.</p>
        ) : (
          assignments.map((assignment) => (
            <div key={assignment.id} className="rounded-xl bg-white border border-gray-200 p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{assignment.trainerProfile.user.name}</p>
                <p className="text-xs text-gray-500 truncate">{assignment.trainerProfile.user.email}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleRemove(assignment.id)}
                disabled={busy}
                className="text-xs font-medium text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-60 shrink-0"
              >
                მოხსნა
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function TrainerAssignmentsPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <Head><title>Trainer Assignments | CDC Admin</title></Head>
        <TrainerAssignmentsContent />
      </AdminLayout>
    </AdminGuard>
  );
}
