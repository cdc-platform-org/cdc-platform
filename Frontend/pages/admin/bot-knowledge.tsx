import { useState, useEffect, useCallback, useRef, DragEvent, FormEvent } from 'react';
import Head from 'next/head';
import { FileText, UploadCloud, Trash2, RefreshCw, Bot, Star } from 'lucide-react';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { useAuth } from '../../src/context/AuthContext';
import { getKnowledgeSources, uploadKnowledgeSource, deleteKnowledgeSource, KnowledgeSource } from '../../src/services/adminKnowledgeService';
import {
  getPlatformAgents,
  createPlatformAgent,
  updatePlatformAgent,
  setDefaultPlatformAgent,
  unsetDefaultPlatformAgent,
  setPlatformAgentKnowledgeSources,
  deletePlatformAgent,
  PlatformAgent,
} from '../../src/services/adminAiAgentsService';

const ALLOWED_EXT = /\.(pdf|docx|md|txt)$/i;

function formatBytes(chars: number): string {
  // Rough size proxy (character count, not the original file's byte size —
  // this is the stored Markdown's length, which is what actually matters
  // for prompt/token cost).
  if (chars < 1000) return `${chars} chars`;
  return `${(chars / 1000).toFixed(1)}k chars`;
}

function AdminBotKnowledgeDashboard() {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSources(await getKnowledgeSources());
    } catch {
      setError('ცოდნის ბაზის ჩატვირთვა ვერ მოხერხდა.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const handleFile = async (file: File) => {
    if (!ALLOWED_EXT.test(file.name)) {
      setUploadError('დაშვებულია მხოლოდ PDF, DOCX ან Markdown (.md) ფაილები.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      await uploadKnowledgeSource(file);
      await loadSources();
    } catch (err: any) {
      setUploadError(err?.response?.data?.message ?? 'ატვირთვა ვერ მოხერხდა.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDelete = async (sourceFilename: string) => {
    if (!window.confirm(`წაიშალოს "${sourceFilename}"?`)) return;
    setError(null);
    try {
      await deleteKnowledgeSource(sourceFilename);
      setSources((prev) => prev.filter((s) => s.sourceFilename !== sourceFilename));
    } catch {
      setError('წაშლა ვერ მოხერხდა.');
    }
  };

  return (
    <>
      <div className="max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">AI ასისტენტის ცოდნის ბაზა</h1>
          <p className="text-sm text-gray-500 mt-1">
            ატვირთეთ დოკუმენტები (PDF, DOCX, Markdown) — ავტომატურად გარდაიქმნება სუფთა Markdown-ად და გამოიყენება CDC-ის
            მთავარი AI ასისტენტის (მთავარ გვერდზე) პასუხებში.
          </p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`rounded-2xl border-2 border-dashed p-10 text-center transition-colors mb-4 ${
            dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-white'
          }`}
        >
          <UploadCloud className={`w-10 h-10 mx-auto mb-3 ${dragActive ? 'text-indigo-500' : 'text-gray-400'}`} />
          <p className="text-sm text-gray-600 mb-3">
            ჩააგდეთ ფაილი აქ, ან
            <label className="text-indigo-600 font-medium cursor-pointer hover:text-indigo-800 ml-1">
              აირჩიეთ ფაილი
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.md,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </p>
          <p className="text-xs text-gray-400">PDF, DOCX, ან Markdown (.md) — მაქს. 20MB</p>
          {uploading && <p className="text-xs font-medium text-indigo-600 mt-3">იტვირთება და მუშავდება…</p>}
        </div>
        {uploadError && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{uploadError}</div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-sm text-gray-900 mb-4">აქტიური დოკუმენტები ({sources.length})</h2>
          {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
          {loading ? (
            <p className="text-sm text-gray-400">იტვირთება…</p>
          ) : sources.length === 0 ? (
            <p className="text-xs text-gray-400">ჯერ არცერთი დოკუმენტი არ არის ატვირთული.</p>
          ) : (
            <div className="space-y-2">
              {sources.map((source) => (
                <div
                  key={source.sourceFilename}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-indigo-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{source.sourceFilename}</p>
                      <p className="text-xs text-gray-400">
                        {source.totalChunks} ნაწილი · {formatBytes(source.totalChars)} · განახლდა{' '}
                        {new Date(source.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <label
                      title="ხელახლა სინქრონიზაცია — ატვირთეთ იგივე ფაილის ახალი ვერსია"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      რესინქრონიზაცია
                      <input
                        type="file"
                        accept=".pdf,.docx,.md,.txt"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFile(file);
                          e.target.value = '';
                        }}
                        className="hidden"
                        disabled={uploading}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDelete(source.sourceFilename)}
                      className="text-red-500 hover:text-red-600 bg-transparent border-none cursor-pointer p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function AgentCard({
  agent,
  knowledgeSources,
  isSuperAdmin,
  onToggleActive,
  onSetDefault,
  onUnsetDefault,
  onSaveSystemPrompt,
  onSaveKnowledgeSources,
  onDelete,
}: {
  agent: PlatformAgent;
  knowledgeSources: KnowledgeSource[];
  isSuperAdmin: boolean;
  onToggleActive: (agent: PlatformAgent) => Promise<void>;
  onSetDefault: (agent: PlatformAgent) => Promise<void>;
  onUnsetDefault: (agent: PlatformAgent) => Promise<void>;
  onSaveSystemPrompt: (agent: PlatformAgent, systemPrompt: string) => Promise<void>;
  onSaveKnowledgeSources: (agent: PlatformAgent, sourceFilenames: string[]) => Promise<void>;
  onDelete: (agent: PlatformAgent) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [promptDraft, setPromptDraft] = useState(agent.systemPrompt);
  const [promptDirty, setPromptDirty] = useState(false);
  const [selectedSources, setSelectedSources] = useState<string[]>(agent.knowledgeSourceFilenames);
  const sourcesDirty = JSON.stringify([...selectedSources].sort()) !== JSON.stringify([...agent.knowledgeSourceFilenames].sort());

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const toggleSource = (filename: string) => {
    setSelectedSources((prev) => (prev.includes(filename) ? prev.filter((f) => f !== filename) : [...prev, filename]));
  };

  return (
    <div className={`rounded-xl border p-5 ${agent.isDefault ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Bot className="w-4 h-4 text-indigo-500 shrink-0" />
            <p className="text-sm font-semibold text-gray-900">{agent.name}</p>
            {agent.nameEn && <span className="text-xs text-gray-400">/ {agent.nameEn}</span>}
            {agent.isDefault && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                <Star className="w-3 h-3" /> Homepage Default
              </span>
            )}
            <span
              className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                agent.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'
              }`}
            >
              {agent.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">/{agent.slug}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => onToggleActive(agent))}
            className="text-xs font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-lg disabled:opacity-50"
          >
            {agent.isActive ? 'Deactivate' : 'Activate'}
          </button>
          {isSuperAdmin && !agent.isDefault && (
            <button
              type="button"
              disabled={busy || !agent.isActive}
              title={!agent.isActive ? 'Activate this agent first' : undefined}
              onClick={() => run(() => onSetDefault(agent))}
              className="text-xs font-medium text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg disabled:opacity-50"
            >
              Set as Homepage Default
            </button>
          )}
          {isSuperAdmin && agent.isDefault && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => onUnsetDefault(agent))}
              className="text-xs font-medium text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg disabled:opacity-50"
            >
              Unset Default
            </button>
          )}
          {isSuperAdmin && (
            <button
              type="button"
              disabled={busy || agent.isDefault}
              title={agent.isDefault ? 'Unset as homepage default before deleting' : undefined}
              onClick={() => run(() => onDelete(agent))}
              className="text-red-500 hover:text-red-600 bg-transparent border-none cursor-pointer p-1 disabled:opacity-30"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <label className="block text-xs font-medium text-gray-700 mb-1">System Prompt</label>
      <textarea
        value={promptDraft}
        onChange={(e) => {
          setPromptDraft(e.target.value);
          setPromptDirty(true);
        }}
        rows={3}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-2"
      />
      {promptDirty && (
        <button
          type="button"
          disabled={busy || !promptDraft.trim()}
          onClick={() =>
            run(async () => {
              await onSaveSystemPrompt(agent, promptDraft.trim());
              setPromptDirty(false);
            })
          }
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg disabled:opacity-50 mb-3"
        >
          Save Prompt
        </button>
      )}

      <label className="block text-xs font-medium text-gray-700 mt-2 mb-1.5">Assigned Knowledge Base Documents</label>
      {knowledgeSources.length === 0 ? (
        <p className="text-xs text-gray-400">No knowledge base documents uploaded yet — see the Knowledge Base tab.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {knowledgeSources.map((source) => (
            <button
              key={source.sourceFilename}
              type="button"
              onClick={() => toggleSource(source.sourceFilename)}
              className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                selectedSources.includes(source.sourceFilename)
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {source.sourceFilename}
            </button>
          ))}
        </div>
      )}
      <p className="text-[11px] text-gray-400 mb-2">
        {selectedSources.length === 0 ? 'None assigned — uses the full knowledge base.' : `${selectedSources.length} document(s) assigned.`}
      </p>
      {sourcesDirty && (
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => onSaveKnowledgeSources(agent, selectedSources))}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg disabled:opacity-50"
        >
          Save Knowledge Sources
        </button>
      )}
    </div>
  );
}

function AiAgentsSection() {
  const { user: viewer } = useAuth();
  const isSuperAdmin = viewer?.adminRole === 'SUPER_ADMIN';
  const [agents, setAgents] = useState<PlatformAgent[]>([]);
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', nameEn: '', slug: '', systemPrompt: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [agentsData, sourcesData] = await Promise.all([getPlatformAgents(), getKnowledgeSources()]);
      setAgents(agentsData);
      setKnowledgeSources(sourcesData);
    } catch {
      setError('AI აგენტების ჩატვირთვა ვერ მოხერხდა.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const replaceAgent = (updated: PlatformAgent) => {
    setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  const runAction = async (fn: () => Promise<PlatformAgent>) => {
    setError(null);
    try {
      replaceAgent(await fn());
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'მოქმედება ვერ შესრულდა.');
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const agent = await createPlatformAgent({
        name: form.name.trim(),
        nameEn: form.nameEn.trim() || undefined,
        slug: form.slug.trim(),
        systemPrompt: form.systemPrompt.trim(),
      });
      setAgents((prev) => [...prev, agent]);
      setForm({ name: '', nameEn: '', slug: '', systemPrompt: '' });
    } catch (err: any) {
      setCreateError(err?.response?.data?.message ?? 'აგენტის შექმნა ვერ მოხერხდა.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (agent: PlatformAgent) => {
    if (!window.confirm(`წაიშალოს "${agent.name}"?`)) return;
    setError(null);
    try {
      await deletePlatformAgent(agent.id);
      setAgents((prev) => prev.filter((a) => a.id !== agent.id));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'წაშლა ვერ მოხერხდა.');
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">AI აგენტები</h1>
        <p className="text-sm text-gray-500 mt-1">
          მართეთ CDC-ის საკუთარი AI ასისტენტები — გადართეთ სტატუსი, დაარედაქტირეთ პერსონა (system prompt) და მიანიჭეთ
          კონკრეტული ცოდნის ბაზის დოკუმენტები თითოეულს. ერთი აგენტი შეიძლება იყოს მთავარი გვერდის ასისტენტის
          &quot;Homepage Default&quot; — მისი პერსონა და ცოდნის ბაზა ცვლის დღევანდელ ავტომატურ პასუხს.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h2 className="font-semibold text-sm text-gray-900 mb-3">ახალი აგენტის დამატება</h2>
        {createError && (
          <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{createError}</div>
        )}
        <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="სახელი (ka) — e.g. კარიერული მრჩეველი"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            value={form.nameEn}
            onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
            placeholder="Name (en, optional)"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            required
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
            placeholder="slug — e.g. career-advisor"
            pattern="[a-z0-9-]+"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <div />
          <textarea
            required
            value={form.systemPrompt}
            onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
            placeholder="System prompt — defines this agent's persona/scope"
            rows={3}
            className="sm:col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={creating}
            className="sm:col-span-2 justify-self-start rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {creating ? 'იქმნება…' : 'აგენტის დამატება'}
          </button>
        </form>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <p className="text-sm text-gray-400">იტვირთება…</p>
      ) : agents.length === 0 ? (
        <p className="text-xs text-gray-400">ჯერ არცერთი აგენტი არ არის დამატებული.</p>
      ) : (
        <div className="space-y-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              knowledgeSources={knowledgeSources}
              isSuperAdmin={isSuperAdmin}
              onToggleActive={(a) => runAction(() => updatePlatformAgent(a.id, { isActive: !a.isActive }))}
              onSetDefault={(a) => runAction(() => setDefaultPlatformAgent(a.id))}
              onUnsetDefault={(a) => runAction(() => unsetDefaultPlatformAgent(a.id))}
              onSaveSystemPrompt={(a, systemPrompt) => runAction(() => updatePlatformAgent(a.id, { systemPrompt }))}
              onSaveKnowledgeSources={(a, sourceFilenames) => runAction(() => setPlatformAgentKnowledgeSources(a.id, sourceFilenames))}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminBotKnowledgePage() {
  const [tab, setTab] = useState<'knowledge' | 'agents'>('knowledge');
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <Head>
          <title>{tab === 'knowledge' ? 'AI Assistant Knowledge Base' : 'AI Agents'} | Admin</title>
        </Head>
        <div className="max-w-4xl mb-6">
          <div className="flex gap-1.5 border-b border-gray-200">
            <button
              type="button"
              onClick={() => setTab('knowledge')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors bg-transparent cursor-pointer ${
                tab === 'knowledge' ? 'border-cyan-500 text-cyan-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              ცოდნის ბაზა / Knowledge Base
            </button>
            <button
              type="button"
              onClick={() => setTab('agents')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors bg-transparent cursor-pointer ${
                tab === 'agents' ? 'border-cyan-500 text-cyan-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              AI აგენტები / AI Agents
            </button>
          </div>
        </div>
        {tab === 'knowledge' ? <AdminBotKnowledgeDashboard /> : <AiAgentsSection />}
      </AdminLayout>
    </AdminGuard>
  );
}
