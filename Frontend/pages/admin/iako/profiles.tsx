import { FormEvent, useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AdminGuard from '@/src/components/admin/AdminGuard';
import AdminLayout from '@/src/components/admin/AdminLayout';
import {
  DigitalToolDefinition, IakoKnowledgeSource, IakoProfile, IakoProfileInput,
  assignIakoProfile, deleteIakoKnowledge, getIakoProfile, listDigitalTools, listIakoProfiles, saveIakoProfile, uploadIakoKnowledge,
} from '@/src/services/iakoAssistantService';

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500';
const buttonClass = 'rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const primaryClass = 'rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50';

const emptyDraft: IakoProfileInput = {
  name: '', description: null, systemPrompt: '', inScope: '', outOfScope: null,
  outOfScopeKeywords: [], visionEnabled: false, temperature: 0.2, active: true,
};

function AdminIakoProfilesContent() {
  const [profiles, setProfiles] = useState<IakoProfile[]>([]);
  const [tools, setTools] = useState<DigitalToolDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [draft, setDraft] = useState<IakoProfileInput | null>(null);
  const [keywordsInput, setKeywordsInput] = useState('');
  const [sources, setSources] = useState<IakoKnowledgeSource[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const [profileList, toolList] = await Promise.all([listIakoProfiles(), listDigitalTools()]);
    setProfiles(profileList);
    setTools(toolList);
  }, []);
  useEffect(() => {
    setLoading(true);
    void load().catch(() => setError('Could not load IAKO profiles.')).finally(() => setLoading(false));
  }, [load]);

  const startCreate = () => { setDraft(emptyDraft); setKeywordsInput(''); setEditingId(undefined); setSources([]); setSaved(false); };
  const startEdit = async (profile: IakoProfile) => {
    const full = await getIakoProfile(profile.id);
    setDraft({
      name: full.name, description: full.description, systemPrompt: full.systemPrompt, inScope: full.inScope,
      outOfScope: full.outOfScope, outOfScopeKeywords: full.outOfScopeKeywords, visionEnabled: full.visionEnabled,
      temperature: full.temperature, active: full.active,
    });
    setKeywordsInput(full.outOfScopeKeywords.join(', '));
    setEditingId(full.id);
    setSources(full.sources);
    setSaved(false);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setBusy(true); setError(''); setSaved(false);
    try {
      const input = { ...draft, outOfScopeKeywords: keywordsInput.split(',').map((k) => k.trim()).filter(Boolean) };
      const saved = await saveIakoProfile(input, editingId);
      setEditingId(saved.id);
      await load();
      setSaved(true);
    } catch {
      setError('Could not save this profile. Check the fields and try again.');
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    if (!editingId) return;
    setUploading(true); setError('');
    try {
      await uploadIakoKnowledge(editingId, file);
      setSources(await getIakoProfile(editingId).then((p) => p.sources));
    } catch {
      setError('Could not upload this document. Only PDF, DOCX, or Markdown files are supported, up to 20MB.');
    } finally {
      setUploading(false);
    }
  };
  const removeSource = async (filename: string) => {
    if (!editingId) return;
    await deleteIakoKnowledge(editingId, filename);
    setSources((current) => current.filter((s) => s.sourceFilename !== filename));
  };

  const assignedToolFor = (toolKey: string) => profiles.find((p) => p.assignments?.some((a) => a.digitalToolKey === toolKey));
  const assignTool = async (toolKey: string, profileId: string) => {
    setBusy(true);
    try { await assignIakoProfile({ digitalToolKey: toolKey }, profileId || null); await load(); }
    finally { setBusy(false); }
  };

  return <main className="max-w-6xl mx-auto p-4 sm:p-8 text-slate-900">
    <Head><title>IAKO Assistant Profiles | CDC Admin</title></Head>
    <Link href="/admin" className="text-sm text-cyan-700">← Admin</Link>
    <h1 className="mt-5 text-2xl sm:text-3xl font-black">IAKO Assistant Profiles</h1>
    <p className="text-sm text-slate-500 mt-2 mb-7">Reusable AI assistant personas — assign one to a Digital Tool below, or to a Live Training from that training&apos;s Daily Guides page.</p>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 mb-5 text-sm text-red-700">{error}</div>}
    {saved && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-5 text-sm text-emerald-700">Saved.</p>}

    {loading ? <p role="status">Loading…</p> : <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 mb-7">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5"><h2 className="text-xl font-bold">Profiles</h2><button type="button" onClick={startCreate} className={primaryClass}>New profile</button></div>
        {!profiles.length ? <p className="text-sm text-slate-500">No profiles yet.</p> : <ul className="divide-y divide-slate-100">
          {profiles.map((profile) => <li key={profile.id} className="py-4 flex flex-wrap justify-between items-center gap-4">
            <div className="min-w-0"><p className="text-xs font-bold text-cyan-700">{profile.active ? 'Active' : 'Inactive'}{profile.visionEnabled ? ' · Vision' : ''}</p><h3 className="font-semibold mt-1">{profile.name}</h3></div>
            <button type="button" onClick={() => void startEdit(profile)} className={buttonClass}>Edit</button>
          </li>)}
        </ul>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 mb-7">
        <h2 className="text-xl font-bold mb-2">Digital Tool assignments</h2>
        <p className="text-sm text-slate-500 mb-5">Which profile answers IAKO questions on each tool page.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {tools.map((tool) => <label key={tool.key} className="text-sm font-medium">{tool.label}
            <select className={`${inputClass} mt-2`} disabled={busy} defaultValue={assignedToolFor(tool.key)?.id ?? ''} onChange={(event) => void assignTool(tool.key, event.target.value)}>
              <option value="">— No assistant —</option>
              {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
            </select>
          </label>)}
        </div>
      </section>

      {draft && <section className="rounded-2xl border border-cyan-200 bg-cyan-50/30 p-5 sm:p-6">
        <h2 className="text-xl font-bold mb-5">{editingId ? 'Edit profile' : 'New profile'}</h2>
        <form onSubmit={submit}><fieldset disabled={busy} className="space-y-5">
          <label className="block text-sm font-medium">Name<input required maxLength={200} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={`${inputClass} mt-2`} /></label>
          <label className="block text-sm font-medium">Description<input maxLength={2000} value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value || null })} className={`${inputClass} mt-2`} /></label>
          <label className="block text-sm font-medium">System prompt / persona<textarea required rows={5} maxLength={8000} value={draft.systemPrompt} onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })} className={`${inputClass} mt-2`} /></label>
          <label className="block text-sm font-medium">In scope — what this assistant may help with<textarea required rows={3} maxLength={4000} value={draft.inScope} onChange={(e) => setDraft({ ...draft, inScope: e.target.value })} className={`${inputClass} mt-2`} /></label>
          <label className="block text-sm font-medium">Out of scope — what it must decline<textarea rows={3} maxLength={4000} value={draft.outOfScope ?? ''} onChange={(e) => setDraft({ ...draft, outOfScope: e.target.value || null })} className={`${inputClass} mt-2`} /></label>
          <label className="block text-sm font-medium">Blocked keywords (comma-separated) — a message containing any of these is refused before the AI is ever called
            <input value={keywordsInput} onChange={(e) => setKeywordsInput(e.target.value)} placeholder="e.g. investment advice, medical diagnosis" className={`${inputClass} mt-2`} />
          </label>
          <div className="grid sm:grid-cols-3 gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.visionEnabled} onChange={(e) => setDraft({ ...draft, visionEnabled: e.target.checked })} className="h-4 w-4 accent-cyan-700" />Accept screenshots (vision)</label>
            <label className="text-sm font-medium">Temperature<input type="number" min={0} max={1} step={0.1} value={draft.temperature} onChange={(e) => setDraft({ ...draft, temperature: Number(e.target.value) })} className={`${inputClass} mt-2`} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="h-4 w-4 accent-cyan-700" />Active</label>
          </div>
          <button type="submit" className={primaryClass}>{busy ? 'Saving…' : 'Save profile'}</button>
        </fieldset></form>

        {editingId && <div className="mt-7 border-t border-cyan-100 pt-5">
          <h3 className="font-bold mb-3">Knowledge base</h3>
          <p className="text-sm text-slate-500 mb-4">PDF, DOCX, or Markdown — parsed, chunked, and searched for relevant context on every question.</p>
          <input type="file" accept=".pdf,.docx,.md,.txt" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ''; }} className="text-sm" />
          {uploading && <p className="text-sm text-slate-500 mt-2">Uploading…</p>}
          {sources.length > 0 && <ul className="mt-4 space-y-2">
            {sources.map((source) => <li key={source.sourceFilename} className="flex justify-between items-center gap-3 border-b border-slate-100 py-2 text-sm">
              <span>{source.sourceFilename} · {source.totalChunks} chunks</span>
              <button type="button" onClick={() => void removeSource(source.sourceFilename)} className="text-red-600 underline text-xs">Remove</button>
            </li>)}
          </ul>}
        </div>}
      </section>}
    </>}
  </main>;
}

export default function AdminIakoProfilesPage() { return <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}><AdminLayout><AdminIakoProfilesContent /></AdminLayout></AdminGuard>; }
