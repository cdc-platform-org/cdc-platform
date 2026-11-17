import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AdminGuard from '@/src/components/admin/AdminGuard';
import AdminLayout from '@/src/components/admin/AdminLayout';
import {
  IakoUsageGrant, addUsageGrantRequests, listUsageGrants, reactivateUsageGrant,
  resetUsageGrant, revokeUsageGrant, updateUsageGrant,
} from '@/src/services/iakoAssistantService';

import { adminLocale, at, atEnum, atf } from '../../../src/i18n/admin';
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
    const raw = window.prompt(at("New limit (blank = unlimited):"), current == null ? '' : String(current));
    if (raw === null) return;
    await updateUsageGrant(grant.id, { [field]: raw.trim() === '' ? null : Number(raw) });
    onChanged();
  };

  return <tr className="border-b border-slate-100 align-top">
    <td className="py-3 pr-3"><p className="font-semibold">{grant.user.name}</p><p className="text-slate-500">{grant.user.email}</p></td>
    <td className="py-3 pr-3">{grant.profile.name}</td>
    <td className="py-3 pr-3">{grant.resourceType === 'LIVE_TRAINING' ? grant.resourceTitle : atf("Tool: {0}", grant.resourceTitle)}</td>
    <td className="py-3 pr-3">{grant.usage.startsAt ? new Date(grant.usage.startsAt).toLocaleDateString(adminLocale()) : '—'}</td>
    <td className="py-3 pr-3">{grant.usage.expiresAt ? new Date(grant.usage.expiresAt).toLocaleDateString(adminLocale()) : '∞'}</td>
    <td className="py-3 pr-3 cursor-pointer" onClick={() => void changeLimit('requestLimit', grant.usage.requestLimit)}>
      {grant.usage.requestsUsed} / {grant.usage.requestLimit ?? '∞'}
      {grant.topUpPolicy && (
        <p className="mt-0.5 font-normal text-[11px] text-slate-500">
          {grant.topUpPolicy.available
            ? atf("Auto top-up available: +{0}", grant.topUpPolicy.amount)
            : atf("Auto top-up applied (max {0})", grant.topUpPolicy.maxTotal)}
        </p>
      )}
    </td>
    <td className="py-3 pr-3 cursor-pointer" onClick={() => void changeLimit('dailyRequestLimit', grant.usage.dailyLimit)}>{grant.usage.dailyUsed} / {grant.usage.dailyLimit ?? '∞'}</td>
    <td className="py-3 pr-3 cursor-pointer" onClick={() => void changeLimit('hourlyRequestLimit', grant.usage.hourlyLimit)}>{grant.usage.hourlyUsed} / {grant.usage.hourlyLimit ?? '∞'}</td>
    <td className="py-3 pr-3 cursor-pointer" onClick={() => void changeLimit('screenshotLimit', grant.usage.screenshotLimit)}>{grant.usage.screenshotsUsed} / {grant.usage.screenshotLimit ?? '∞'}</td>
    <td className="py-3 pr-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_CLASS[status]}`}>{atEnum(status)}</span></td>
    <td className="py-3">
      <div className="flex flex-wrap gap-1.5 items-center">
        <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={inputClass} />
        <button type="button" disabled={busy} onClick={() => void extend()} className={buttonClass}>{at("Extend")}</button>
        <button type="button" disabled={busy} onClick={() => addUsageGrantRequests(grant.id, 50).then(onChanged)} className={buttonClass}>+50</button>
        <button type="button" disabled={busy} onClick={() => resetUsageGrant(grant.id).then(onChanged)} className={buttonClass}>{at("Reset usage")}</button>
        {status === 'REVOKED'
          ? <button type="button" disabled={busy} onClick={() => reactivateUsageGrant(grant.id).then(onChanged)} className={buttonClass}>{at("Reactivate")}</button>
          : <button type="button" disabled={busy} onClick={() => revokeUsageGrant(grant.id).then(onChanged)} className={buttonClass}>{at("Revoke")}</button>}
        <button type="button" disabled={busy} onClick={() => updateUsageGrant(grant.id, { requestLimit: null, dailyRequestLimit: null, hourlyRequestLimit: null, screenshotLimit: null }).then(onChanged)} className={buttonClass}>{at("Unlimited")}</button>
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
    <Head><title>{at("IAKO Usage | CDC Admin")}</title></Head>
    <Link href="/admin/iako/profiles" className="text-sm text-cyan-700">{at("← IAKO Profiles")}</Link>
    <h1 className="mt-5 text-2xl sm:text-3xl font-black">{at("IAKO Usage")}</h1>
    <p className="text-sm text-slate-500 mt-2 mb-7">{at("Every learner's access grant and quota. Click a usage cell to change that limit.")}</p>

    {loading ? <p role="status">{at("Loading…")}</p> : (
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-xs text-left">
          <thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-3 pl-3 pr-3">{at("User")}</th><th className="pr-3">{at("Profile")}</th><th className="pr-3">{at("Training / Tool")}</th><th className="pr-3">{at("Starts")}</th><th className="pr-3">{at("Expires")}</th><th className="pr-3">{at("Requests")}</th><th className="pr-3">{at("Today")}</th><th className="pr-3">{at("This hour")}</th><th className="pr-3">{at("Screenshots")}</th><th className="pr-3">{at("Status")}</th><th>{at("Actions")}</th></tr></thead>
          <tbody>{grants.map((grant) => <GrantRow key={grant.id} grant={grant} busy={busy} onChanged={onChanged} />)}</tbody>
        </table>
        {!grants.length && <p className="text-sm text-slate-500 p-5">{at("No usage grants yet — they're created automatically the first time a learner opens IAKO.")}</p>}
      </div>
    )}
  </main>;
}

export default function AdminIakoUsagePage() { return <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}><AdminLayout><AdminIakoUsageContent /></AdminLayout></AdminGuard>; }
