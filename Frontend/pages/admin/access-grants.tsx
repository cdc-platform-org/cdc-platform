import { FormEvent, useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AdminGuard from '@/src/components/admin/AdminGuard';
import AdminLayout from '@/src/components/admin/AdminLayout';
import { AccessGrant, AccessGrantResourceType, createAccessGrant, listAccessGrants, revokeAccessGrant } from '@/src/services/accessGrantService';
import { listDigitalTools, DigitalToolDefinition } from '@/src/services/iakoAssistantService';

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500';
const buttonClass = 'rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const primaryClass = 'rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50';

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
    void load().catch(() => setError('Could not load access grants.')).finally(() => setLoading(false));
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
      setError('Could not create this grant. Provide a valid email and resource.');
    } finally {
      setBusy(false);
    }
  };
  const doRevoke = async (id: string) => {
    setBusy(true); setError('');
    try { await revokeAccessGrant(id); await load(); }
    catch { setError('Could not revoke this grant. Please try again.'); }
    finally { setBusy(false); }
  };

  return <main className="max-w-5xl mx-auto p-4 sm:p-8 text-slate-900">
    <Head><title>Access Grants | CDC Admin</title></Head>
    <Link href="/admin" className="text-sm text-cyan-700">← Admin</Link>
    <h1 className="mt-5 text-2xl sm:text-3xl font-black">Access Grants</h1>
    <p className="text-sm text-slate-500 mt-2 mb-7">Temporary entitlements, by user or email, independent of any purchase or enrollment — checked alongside a resource&apos;s own natural entitlement, never in place of it.</p>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 mb-5 text-sm text-red-700">{error}</div>}

    {loading ? <p role="status">Loading…</p> : <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 mb-7">
        <h2 className="text-xl font-bold mb-4">New grant</h2>
        <form onSubmit={submit}><fieldset disabled={busy} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-sm font-medium">Resource type
              <select value={resourceType} onChange={(e) => { setResourceType(e.target.value as AccessGrantResourceType); setResourceId(''); }} className={`${inputClass} mt-2`}>
                <option value="DIGITAL_TOOL">Digital Tool</option>
                <option value="LIVE_TRAINING">Live Training</option>
                <option value="IAKO_PROFILE">IAKO Profile</option>
              </select>
            </label>
            <label className="text-sm font-medium">Resource
              {resourceType === 'DIGITAL_TOOL' ? (
                <select required value={resourceId} onChange={(e) => setResourceId(e.target.value)} className={`${inputClass} mt-2`}>
                  <option value="">— choose a tool —</option>
                  {tools.map((tool) => <option key={tool.key} value={tool.key}>{tool.label}</option>)}
                </select>
              ) : (
                <input required placeholder={resourceType === 'LIVE_TRAINING' ? 'Live Training ID' : 'IAKO Profile ID'} value={resourceId} onChange={(e) => setResourceId(e.target.value)} className={`${inputClass} mt-2`} />
              )}
            </label>
          </div>
          <label className="block text-sm font-medium">Email — works even before the person registers<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} mt-2`} /></label>
          <div className="grid sm:grid-cols-3 gap-4">
            <label className="text-sm font-medium">Starts at (optional)<input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={`${inputClass} mt-2`} /></label>
            <label className="text-sm font-medium">Expires at (optional)<input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={`${inputClass} mt-2`} /></label>
            <label className="text-sm font-medium">Note (optional)<input value={note} onChange={(e) => setNote(e.target.value)} className={`${inputClass} mt-2`} /></label>
          </div>
          <button type="submit" className={primaryClass}>Create grant</button>
        </fieldset></form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-bold mb-4">All grants</h2>
        <ul className="divide-y divide-slate-100">
          {grants.map((grant) => <li key={grant.id} className="py-3 flex flex-wrap justify-between items-center gap-3 text-sm">
            <span>{grant.resourceType} · {grant.resourceId} · {grant.user?.email ?? grant.email}{grant.revokedAt ? ' · revoked' : grant.expiresAt ? ` · until ${new Date(grant.expiresAt).toLocaleDateString()}` : ''}</span>
            {!grant.revokedAt && <button type="button" disabled={busy} onClick={() => void doRevoke(grant.id)} className={buttonClass}>Revoke</button>}
          </li>)}
          {!grants.length && <p className="text-sm text-slate-500 py-3">No grants yet.</p>}
        </ul>
      </section>
    </>}
  </main>;
}

export default function AdminAccessGrantsPage() { return <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}><AdminLayout><AdminAccessGrantsContent /></AdminLayout></AdminGuard>; }
