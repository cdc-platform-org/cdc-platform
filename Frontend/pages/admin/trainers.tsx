import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import AdminGuard from '@/src/components/admin/AdminGuard';
import AdminLayout from '@/src/components/admin/AdminLayout';
import {
  getAdminTrainers,
  createTrainerProfile,
  setTrainerProfileActive,
  AdminTrainerProfile,
} from '@/src/services/adminTrainerService';

// ============================================================
// IAKO Trainer Tools — global Trainer roster admin (Phase 1).
// Enables/disables the Trainer *capability* on existing User
// accounts. Deliberately NOT the marketing team-trainers CMS
// (pages/admin/team-trainers.tsx) and NOT AdminRole tiers
// (pages/admin/team.tsx). Per-training assignment lives on the
// existing /admin/live-trainings page.
// ============================================================

function AdminTrainersDashboard() {
  const [trainers, setTrainers] = useState<AdminTrainerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTrainers(await getAdminTrainers());
    } catch {
      setError('Unable to load the trainer roster.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async () => {
    setMessage(null);
    setBusy(true);
    try {
      const resolved = await fetch(`/api/admin/users?search=${encodeURIComponent(email.trim())}`)
        .then((r) => (r.ok ? r.json() : null));
      const userId = (resolved?.data as Array<{ id: string; email: string }> | undefined)
        ?.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())?.id;
      if (!userId) {
        setMessage(`No user found with email ${email.trim()}.`);
        return;
      }
      await createTrainerProfile(userId);
      setEmail('');
      await load();
      setMessage('Trainer enabled.');
    } catch (err: unknown) {
      const apiMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMessage(apiMessage ?? 'Unable to enable this trainer.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (trainer: AdminTrainerProfile) => {
    setBusy(true);
    setMessage(null);
    try {
      await setTrainerProfileActive(trainer.id, !trainer.active);
      await load();
    } catch {
      setMessage('Unable to update this trainer.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold text-gray-900">ტრენერების რეესტრი</h1>
      <p className="text-sm text-gray-500 mt-1">
        ჩართეთ/გამორთეთ Trainer შესაძლებლობა არსებულ მომხმარებელზე. ცალკეა მარკეტინგული გუნდის გვერდისგან და AdminRole-სგან.
      </p>

      <div className="mt-5 flex gap-2 items-start flex-wrap">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@cdc.org.ge"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-72"
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={busy || !email.trim()}
          className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {busy ? '…' : 'ტრენერად ჩართვა'}
        </button>
      </div>
      {message && <p className="mt-2 text-xs text-gray-600">{message}</p>}
      {error && <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="mt-6 space-y-2">
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : trainers.length === 0 ? (
          <p className="text-sm text-gray-500">ტრენერები ჯერ არ არიან დამატებული.</p>
        ) : (
          trainers.map((trainer) => (
            <div key={trainer.id} className="rounded-xl bg-white border border-gray-200 p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{trainer.user.name}</p>
                <p className="text-xs text-gray-500 truncate">{trainer.user.email} · {trainer._count.assignments} ტრენინგზე მინიჭებული</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${trainer.active ? 'text-emerald-600 bg-emerald-50' : 'text-gray-500 bg-gray-100'}`}>
                  {trainer.active ? 'აქტიური' : 'გამორთული'}
                </span>
                <button
                  type="button"
                  onClick={() => void toggle(trainer)}
                  disabled={busy}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-50 disabled:opacity-60"
                >
                  {trainer.active ? 'გამორთვა' : 'ჩართვა'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function AdminTrainersPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <Head><title>Trainer Roster | CDC Admin</title></Head>
        <AdminTrainersDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
