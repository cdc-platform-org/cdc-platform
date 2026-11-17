import { FormEvent, useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AdminGuard from '@/src/components/admin/AdminGuard';
import AdminLayout from '@/src/components/admin/AdminLayout';
import { AccessGrant, AccessGrantResourceType, CollegeAiAccess, createAccessGrant, getCollegeAiAccess, listAccessGrants, revokeAccessGrant } from '@/src/services/accessGrantService';
import { listDigitalTools, DigitalToolDefinition } from '@/src/services/iakoAssistantService';

import { adminLocale, at, atf } from '../../src/i18n/admin';
const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500';
const buttonClass = 'rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const primaryClass = 'rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50';

// Course students get every AI tool free while a paid course is unfinished
// (max 90 days from enrollment). This card shows that live status per email.
function CollegeAiAccessLookup() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<CollegeAiAccess | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [checking, setChecking] = useState(false);
  const check = async (e: FormEvent) => {
    e.preventDefault();
    setChecking(true); setLookupError(''); setResult(null);
    try { setResult(await getCollegeAiAccess(email.trim())); }
    catch { setLookupError(at('No user found with this email.')); }
    finally { setChecking(false); }
  };
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 mb-6">
    <h2 className="text-xl font-bold mb-1">{at('Free AI access for course students')}</h2>
    <p className="text-sm text-slate-500 mb-4">{at('A student of a paid course gets all AI tools free until the course is finished or 90 days pass since enrollment.')}</p>
    <form onSubmit={check} className="flex flex-wrap gap-2">
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@example.com" className={`${inputClass} max-w-sm`} />
      <button type="submit" disabled={checking} className={primaryClass}>{checking ? at('Checking…') : at('Check')}</button>
    </form>
    {lookupError && <p className="mt-3 text-sm text-red-600">{lookupError}</p>}
    {result && <p className="mt-3 text-sm text-slate-700">
      {result.user.name} ({result.user.email}) — {result.active
        ? atf('active until {0}', result.endsAt ? new Date(result.endsAt).toLocaleDateString(adminLocale()) : '—')
        : result.ended ? at('course access has ended') : at('no paid course enrollment')}
    </p>}
  </section>;
}

function AdminAccessGrantsContent() {
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [tools, setTools] = useState<DigitalToolDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resourceType, setResourceType] = useState<AccessGrantResourceType>('DIGITAL_TOOL');
  const [resourceId, setResourceId] = useState('');
  const [email, setEmail] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const [g, t] = await Promise.all([listAccessGrants(), listDigitalTools()]);
    setGrants(g); setTools(t);
  }, []);
  useEffect(() => {
    setLoading(true);
    void load().catch(() => setError(at("Could not load access grants."))).finally(() => setLoading(false));
  }, [load]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await createAccessGrant({
        resourceType, resourceId, email, startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null, note: note || null,
      });
      setResourceId(''); setEmail(''); setStartsAt(''); setExpiresAt(''); setNote('');
      await load();
    } catch {
      setError(at("Could not create this grant. Provide a valid email and resource."));
    } finally {
      setBusy(false);
    }
  };
  const doRevoke = async (id: string) => {
    setBusy(true); setError('');
    try { await revokeAccessGrant(id); await load(); }
    catch { setError(at("Could not revoke this grant. Please try again.")); }
    finally { setBusy(false); }
  };

  return <main className="max-w-5xl mx-auto p-4 sm:p-8 text-slate-900">
    <Head><title>{at("Access Grants | CDC Admin")}</title></Head>
    <Link href="/admin" className="text-sm text-cyan-700">{at("← Admin")}</Link>
    <h1 className="mt-5 text-2xl sm:text-3xl font-black">{at("Access Grants")}</h1>
    <p className="text-sm text-slate-500 mt-2 mb-7">{at("Temporary entitlements, by user or email, independent of any purchase or enrollment — checked alongside a resource's own natural entitlement, never in place of it.")}</p>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 mb-5 text-sm text-red-700">{error}</div>}

    <CollegeAiAccessLookup />

    {loading ? <p role="status">{at("Loading…")}</p> : <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 mb-7">
        <h2 className="text-xl font-bold mb-4">{at("New grant")}</h2>
        <form onSubmit={submit}><fieldset disabled={busy} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-sm font-medium">{at("Resource type")}
              <select value={resourceType} onChange={(e) => { setResourceType(e.target.value as AccessGrantResourceType); setResourceId(''); }} className={`${inputClass} mt-2`}>
                <option value="DIGITAL_TOOL">{at("Digital Tool")}</option>
                <option value="LIVE_TRAINING">{at("Live Training")}</option>
                <option value="IAKO_PROFILE">{at("IAKO Profile")}</option>
              </select>
            </label>
            <label className="text-sm font-medium">{at("Resource")}
              {resourceType === 'DIGITAL_TOOL' ? (
                <select required value={resourceId} onChange={(e) => setResourceId(e.target.value)} className={`${inputClass} mt-2`}>
                  <option value="">{at("— choose a tool —")}</option>
                  {tools.map((tool) => <option key={tool.key} value={tool.key}>{tool.label}</option>)}
                </select>
              ) : (
                <input required placeholder={resourceType === 'LIVE_TRAINING' ? at("Live Training ID") : at("IAKO Profile ID")} value={resourceId} onChange={(e) => setResourceId(e.target.value)} className={`${inputClass} mt-2`} />
              )}
            </label>
          </div>
          <label className="block text-sm font-medium">{at("Email — works even before the person registers")}<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} mt-2`} /></label>
          <div className="grid sm:grid-cols-3 gap-4">
            <label className="text-sm font-medium">{at("Starts at (optional)")}<input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={`${inputClass} mt-2`} /></label>
            <label className="text-sm font-medium">{at("Expires at (optional)")}<input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={`${inputClass} mt-2`} /></label>
            <label className="text-sm font-medium">{at("Note (optional)")}<input value={note} onChange={(e) => setNote(e.target.value)} className={`${inputClass} mt-2`} /></label>
          </div>
          <button type="submit" className={primaryClass}>{at("Create grant")}</button>
        </fieldset></form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-bold mb-4">{at("All grants")}</h2>
        <ul className="divide-y divide-slate-100">
          {grants.map((grant) => <li key={grant.id} className="py-3 flex flex-wrap justify-between items-center gap-3 text-sm">
            <span>{grant.resourceType} · {grant.resourceId} · {grant.user?.email ?? grant.email}{grant.revokedAt ? at(" · revoked") : grant.expiresAt ? atf(" · until {0}", new Date(grant.expiresAt).toLocaleDateString(adminLocale())) : ''}</span>
            {!grant.revokedAt && <button type="button" disabled={busy} onClick={() => void doRevoke(grant.id)} className={buttonClass}>{at("Revoke")}</button>}
          </li>)}
          {!grants.length && <p className="text-sm text-slate-500 py-3">{at("No grants yet.")}</p>}
        </ul>
      </section>
    </>}
  </main>;
}

export default function AdminAccessGrantsPage() { return <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}><AdminLayout><AdminAccessGrantsContent /></AdminLayout></AdminGuard>; }
