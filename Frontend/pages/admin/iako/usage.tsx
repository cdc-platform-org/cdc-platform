import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AdminGuard from '@/src/components/admin/AdminGuard';
import AdminLayout from '@/src/components/admin/AdminLayout';
import {
  IakoUsageGrant, addUsageGrantRequests, listUsageGrants, reactivateUsageGrant,
  resetUsageGrant, revokeUsageGrant, updateUsageGrant,
} from '@/src/services/iakoAssistantService';

const buttonClass = 'rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const inputClass = 'w-24 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900';

function statusOf(grant: IakoUsageGrant): 'REVOKED' | 'EXPIRED' | 'ACTIVE' {
  if (grant.usage.revokedAt) return 'REVOKED';
  if (grant.usage.expiresAt && new Date(grant.usage.expiresAt) < new Date()) return 'EXPIRED';
  return 'ACTIVE';
}
const STATUS_CLASS: Record<string, string> = { ACTIVE: 'bg-emerald-100 text-emerald-700', EXPIRED: 'bg-slate-200 text-slate-600', REVOKED: 'bg-red-100 text-red-700' };

function GrantRow({ grant, busy, onChanged }: { grant: IakoUsageGrant; busy: boolean; onChanged: () => void }) {
  const [expiresAt, setExpiresAt] = useState(grant.usage.expiresAt?.slice(0, 10) ?? '');
  const status = statusOf(grant);

  const extend = async () => { if (expiresAt) { await updateUsageGrant(grant.id, { expiresAt: new Date(expiresAt).toISOString() }); onChanged(); } };
  const changeLimit = async (field: 'requestLimit' | 'dailyRequestLimit' | 'hourlyRequestLimit' | 'screenshotLimit', current: number | null) => {
    const raw = window.prompt('New limit (blank = unlimited):', current == null ? '' : String(current));
    if (raw === null) return;
    await updateUsageGrant(grant.id, { [field]: raw.trim() === '' ? null : Number(raw) });
    onChanged();
  };

  return <tr className="border-b border-slate-100 align-top">
    <td className="py-3 pr-3"><p className="font-semibold">{grant.user.name}</p><p className="text-slate-500">{grant.user.email}</p></td>
    <td className="py-3 pr-3">{grant.profile.name}</td>
    <td className="py-3 pr-3">{grant.resourceType === 'LIVE_TRAINING' ? grant.resourceTitle : `Tool: ${grant.resourceTitle}`}</td>
    <td className="py-3 pr-3">{grant.usage.startsAt ? new Date(grant.usage.startsAt).toLocaleDateString() : '—'}</td>
    <td className="py-3 pr-3">{grant.usage.expiresAt ? new Date(grant.usage.expiresAt).toLocaleDateString() : '∞'}</td>
    <td className="py-3 pr-3 cursor-pointer" onClick={() => void changeLimit('requestLimit', grant.usage.requestLimit)}>{grant.usage.requestsUsed} / {grant.usage.requestLimit ?? '∞'}</td>
    <td className="py-3 pr-3 cursor-pointer" onClick={() => void changeLimit('dailyRequestLimit', grant.usage.dailyLimit)}>{grant.usage.dailyUsed} / {grant.usage.dailyLimit ?? '∞'}</td>
    <td className="py-3 pr-3 cursor-pointer" onClick={() => void changeLimit('hourlyRequestLimit', grant.usage.hourlyLimit)}>{grant.usage.hourlyUsed} / {grant.usage.hourlyLimit ?? '∞'}</td>
    <td className="py-3 pr-3 cursor-pointer" onClick={() => void changeLimit('screenshotLimit', grant.usage.screenshotLimit)}>{grant.usage.screenshotsUsed} / {grant.usage.screenshotLimit ?? '∞'}</td>
    <td className="py-3 pr-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_CLASS[status]}`}>{status}</span></td>
    <td className="py-3">
      <div className="flex flex-wrap gap-1.5 items-center">
        <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={inputClass} />
        <button type="button" disabled={busy} onClick={() => void extend()} className={buttonClass}>Extend</button>
        <button type="button" disabled={busy} onClick={() => addUsageGrantRequests(grant.id, 50).then(onChanged)} className={buttonClass}>+50</button>
        <button type="button" disabled={busy} onClick={() => resetUsageGrant(grant.id).then(onChanged)} className={buttonClass}>Reset usage</button>
        {status === 'REVOKED'
          ? <button type="button" disabled={busy} onClick={() => reactivateUsageGrant(grant.id).then(onChanged)} className={buttonClass}>Reactivate</button>
          : <button type="button" disabled={busy} onClick={() => revokeUsageGrant(grant.id).then(onChanged)} className={buttonClass}>Revoke</button>}
        <button type="button" disabled={busy} onClick={() => updateUsageGrant(grant.id, { requestLimit: null, dailyRequestLimit: null, hourlyRequestLimit: null, screenshotLimit: null }).then(onChanged)} className={buttonClass}>Unlimited</button>
      </div>
    </td>
  </tr>;
}

function AdminIakoUsageContent() {
  const [grants, setGrants] = useState<IakoUsageGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => setGrants(await listUsageGrants()), []);
  useEffect(() => { setLoading(true); void load().finally(() => setLoading(false)); }, [load]);
  const onChanged = () => { setBusy(true); void load().finally(() => setBusy(false)); };

  return <main className="max-w-6xl mx-auto p-4 sm:p-8 text-slate-900">
    <Head><title>IAKO Usage | CDC Admin</title></Head>
    <Link href="/admin/iako/profiles" className="text-sm text-cyan-700">← IAKO Profiles</Link>
    <h1 className="mt-5 text-2xl sm:text-3xl font-black">IAKO Usage</h1>
    <p className="text-sm text-slate-500 mt-2 mb-7">Every learner&apos;s access grant and quota. Click a usage cell to change that limit.</p>

    {loading ? <p role="status">Loading…</p> : (
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-xs text-left">
          <thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-3 pl-3 pr-3">User</th><th className="pr-3">Profile</th><th className="pr-3">Training / Tool</th><th className="pr-3">Starts</th><th className="pr-3">Expires</th><th className="pr-3">Requests</th><th className="pr-3">Today</th><th className="pr-3">This hour</th><th className="pr-3">Screenshots</th><th className="pr-3">Status</th><th>Actions</th></tr></thead>
          <tbody>{grants.map((grant) => <GrantRow key={grant.id} grant={grant} busy={busy} onChanged={onChanged} />)}</tbody>
        </table>
        {!grants.length && <p className="text-sm text-slate-500 p-5">No usage grants yet — they&apos;re created automatically the first time a learner opens IAKO.</p>}
      </div>
    )}
  </main>;
}

export default function AdminIakoUsagePage() { return <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}><AdminLayout><AdminIakoUsageContent /></AdminLayout></AdminGuard>; }
