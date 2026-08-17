import { useState, useEffect, useCallback, useRef, ChangeEvent, FormEvent } from 'react';
import {
  Bot,
  Plus,
  Settings,
  BookOpen,
  Code2,
  BarChart3,
  Trash2,
  Copy,
  Check,
  Pause,
  Play,
  UploadCloud,
  Info,
} from 'lucide-react';
import {
  getMyAgents,
  createAgent,
  updateAgent,
  deleteAgent,
  getKnowledgeDocuments,
  createKnowledgeDocument,
  deleteKnowledgeDocument,
  uploadKnowledgeFile,
  getAgentConversations,
  AgentFormPayload,
} from '../../services/agentService';
import { Agent, KnowledgeDocument, AgentConversation } from '../../types/agent';
import ProductOverviewCard from '../tools/ProductOverviewCard';
import { PRODUCT_OVERVIEW } from '../../data/productOverviews';

type SubTab = 'config' | 'knowledge' | 'embed' | 'overview' | 'analytics';
type SetupGuidePlatform = 'wordpress' | 'shopify' | 'html';

const dict = {
  ka: {
    title: 'CDC ბიზნეს AI',
    subtitle: 'შექმენით და მართეთ AI ჩატბოტი თქვენი საიტისთვის.',
    newAgent: '+ ახალი აგენტი',
    noAgents: 'ჯერ არცერთი AI აგენტი არ გაქვთ.',
    createFirst: 'შექმენით პირველი აგენტი',
    trial: 'საცდელი პერიოდი',
    active: 'აქტიური',
    paused: 'შეჩერებული',
    trialEndsAt: 'საცდელი პერიოდი მთავრდება',
    pause: 'შეჩერება',
    resume: 'განახლება',
    delete: 'წაშლა',
    deleteConfirm: 'დარწმუნებული ხართ, რომ გსურთ ამ აგენტის წაშლა?',
    tabConfig: 'კონფიგურაცია',
    tabKnowledge: 'ცოდნის ბაზა',
    tabEmbed: 'ჩაშენების კოდი',
    tabOverview: 'პროდუქტის მიმოხილვა',
    tabAnalytics: 'ანალიტიკა',
    name: 'სახელი',
    primaryColor: 'ძირითადი ფერი',
    systemPrompt: 'სისტემური მოთხოვნა (Persona)',
    systemPromptPlaceholder: 'შენ ხარ CDC-ის დამხმარე ასისტენტი. უპასუხე თავაზიანად...',
    allowedOrigins: 'დაშვებული დომენები (თითო ხაზზე)',
    allowedOriginsPlaceholder: 'https://example.com',
    fallbackPhone: 'სარეზერვო ტელეფონის ნომერი',
    save: 'შენახვა',
    saving: 'ინახება…',
    saved: 'შენახულია ✓',
    createButton: 'აგენტის შექმნა',
    creating: 'იქმნება…',
    knowledgeHint: 'დაამატეთ კითხვა-პასუხის წყვილები ან თავისუფალი კონტექსტი, რომელსაც აგენტი გამოიყენებს პასუხების დროს.',
    question: 'კითხვა (არასავალდებულო)',
    content: 'პასუხი / კონტექსტი',
    addKnowledge: '+ დამატება',
    noKnowledge: 'ცოდნის ბაზა ცარიელია.',
    uploadFileHint: 'ან ატვირთეთ დოკუმენტი (PDF, DOCX, Markdown) — ავტომატურად გარდაიქმნება და დაემატება.',
    uploadFile: 'ფაილის ატვირთვა',
    uploadingFile: 'მუშავდება…',
    uploadFileError: 'ფაილის ატვირთვა ვერ მოხერხდა.',
    embedHint: 'ჩასვით ეს კოდი თქვენი საიტის </body> ტეგამდე.',
    copyCode: 'კოდის კოპირება',
    copied: 'დაკოპირდა ✓',
    setupGuideTitle: 'დაყენებისა და ინტეგრაციის სახელმძღვანელო',
    setupWordpress: 'WordPress',
    setupShopify: 'Shopify',
    setupHtml: 'Custom HTML',
    setupWordpressSteps: [
      'WordPress ადმინ პანელში გადადით Appearance → Theme File Editor-ში.',
      'გახსენით footer.php და ჩასვით კოდი </body> ტეგის წინ.',
      'ან გამოიყენეთ "Insert Headers and Footers" ტიპის plugin და ჩასვით კოდი "Footer" ველში — plugin-ი არ საჭიროებს თემის ფაილების რედაქტირებას.',
    ],
    setupShopifySteps: [
      'Shopify ადმინში გადადით Online Store → Themes → Edit Code-ზე.',
      'გახსენით theme.liquid ფაილი Layout საქაღალდეში.',
      'ჩასვით კოდი </body> ტეგის წინ და შეინახეთ.',
    ],
    setupHtmlSteps: [
      'გახსენით თქვენი საიტის HTML ფაილი ან CMS-ის template რედაქტორი.',
      'იპოვეთ დახურვის </body> ტეგი გვერდის ბოლოში.',
      'ჩასვით კოდი პირდაპირ </body> ტეგის წინ ყველა გვერდზე, სადაც გსურთ ასისტენტის გამოჩენა.',
    ],
    analyticsHint: 'ბოლო საუბრები ვიზიტორებთან.',
    noConversations: 'საუბრები ჯერ არ არის.',
    messages: 'შეტყობინება',
    cancel: 'გაუქმება',
    genericError: 'დაფიქსირდა შეცდომა. სცადეთ თავიდან.',
  },
  en: {
    title: 'CDC Business AI',
    subtitle: 'Create and manage an AI chatbot for your website.',
    newAgent: '+ New Agent',
    noAgents: "You don't have any AI agents yet.",
    createFirst: 'Create your first agent',
    trial: 'Trial',
    active: 'Active',
    paused: 'Paused',
    trialEndsAt: 'Trial ends',
    pause: 'Pause',
    resume: 'Resume',
    delete: 'Delete',
    deleteConfirm: 'Are you sure you want to delete this agent?',
    tabConfig: 'Configuration',
    tabKnowledge: 'Knowledge Base',
    tabEmbed: 'Embed Code',
    tabOverview: 'Product Overview',
    tabAnalytics: 'Analytics',
    name: 'Name',
    primaryColor: 'Primary Color',
    systemPrompt: 'System Prompt (Persona)',
    systemPromptPlaceholder: 'You are a helpful assistant for CDC. Answer politely...',
    allowedOrigins: 'Allowed Domains (one per line)',
    allowedOriginsPlaceholder: 'https://example.com',
    fallbackPhone: 'Fallback Phone Number',
    save: 'Save Changes',
    saving: 'Saving…',
    saved: 'Saved ✓',
    createButton: 'Create Agent',
    creating: 'Creating…',
    knowledgeHint: "Add Q&A pairs or freeform context the agent will use when answering.",
    question: 'Question (optional)',
    content: 'Answer / Context',
    addKnowledge: '+ Add',
    noKnowledge: 'The knowledge base is empty.',
    uploadFileHint: 'Or upload a document (PDF, DOCX, Markdown) — it will be converted and added automatically.',
    uploadFile: 'Upload File',
    uploadingFile: 'Processing…',
    uploadFileError: 'Unable to upload the file.',
    embedHint: 'Paste this snippet before the closing </body> tag on your site.',
    copyCode: 'Copy Code',
    copied: 'Copied ✓',
    setupGuideTitle: 'Setup & Integration Guide',
    setupWordpress: 'WordPress',
    setupShopify: 'Shopify',
    setupHtml: 'Custom HTML',
    setupWordpressSteps: [
      'In your WordPress admin, go to Appearance → Theme File Editor.',
      'Open footer.php and paste the snippet right before the closing </body> tag.',
      'Or use a plugin like "Insert Headers and Footers" and paste the snippet into the Footer field — no theme file editing required.',
    ],
    setupShopifySteps: [
      'In your Shopify admin, go to Online Store → Themes → Edit Code.',
      'Open theme.liquid inside the Layout folder.',
      'Paste the snippet right before the closing </body> tag and save.',
    ],
    setupHtmlSteps: [
      'Open your site\'s HTML file or your CMS\'s template editor.',
      'Find the closing </body> tag near the bottom of the page.',
      'Paste the snippet directly before </body> on every page you want the assistant to appear on.',
    ],
    analyticsHint: 'Recent conversations with visitors.',
    noConversations: 'No conversations yet.',
    messages: 'messages',
    cancel: 'Cancel',
    genericError: 'Something went wrong. Please try again.',
  },
};

const STATUS_BADGE: Record<string, string> = {
  TRIAL: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  ACTIVE: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  PAUSED: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/30',
};

const inputClass =
  'w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500';
const labelClass = 'block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5';

const emptyForm: AgentFormPayload = { name: '', primaryColor: '#06b6d4', systemPrompt: '', allowedOrigins: [], fallbackPhone: '' };

export default function BusinessAiTab({ lang }: { lang: 'ka' | 'en' }) {
  const t = dict[lang];
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<SubTab>('config');

  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [createOriginsText, setCreateOriginsText] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [configForm, setConfigForm] = useState(emptyForm);
  const [configOriginsText, setConfigOriginsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [knowledge, setKnowledge] = useState<KnowledgeDocument[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [newContent, setNewContent] = useState('');
  const [addingKnowledge, setAddingKnowledge] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadFileError, setUploadFileError] = useState<string | null>(null);
  const knowledgeFileInputRef = useRef<HTMLInputElement>(null);

  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [setupPlatform, setSetupPlatform] = useState<SetupGuidePlatform>('wordpress');

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? null;

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyAgents();
      setAgents(data);
      if (data.length > 0 && !selectedAgentId) setSelectedAgentId(data[0].id);
    } catch {
      setActionError(t.genericError);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    if (!selectedAgent) return;
    setConfigForm({
      name: selectedAgent.name,
      primaryColor: selectedAgent.primaryColor,
      systemPrompt: selectedAgent.systemPrompt,
      allowedOrigins: selectedAgent.allowedOrigins,
      fallbackPhone: selectedAgent.fallbackPhone ?? '',
    });
    setConfigOriginsText(selectedAgent.allowedOrigins.join('\n'));
  }, [selectedAgent]);

  useEffect(() => {
    if (!selectedAgentId) return;
    if (subTab === 'knowledge') {
      getKnowledgeDocuments(selectedAgentId).then(setKnowledge).catch(() => setActionError(t.genericError));
    } else if (subTab === 'analytics') {
      getAgentConversations(selectedAgentId).then(setConversations).catch(() => setActionError(t.genericError));
    }
  }, [selectedAgentId, subTab, t.genericError]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const originsList = createOriginsText.split('\n').map((s) => s.trim()).filter(Boolean);
      const agent = await createAgent({ ...createForm, allowedOrigins: originsList });
      setAgents((prev) => [agent, ...prev]);
      setSelectedAgentId(agent.id);
      setShowCreateForm(false);
      setCreateForm(emptyForm);
      setCreateOriginsText('');
    } catch (err: any) {
      const apiErrors = err?.response?.data?.errors;
      setCreateError(Array.isArray(apiErrors) ? apiErrors.map((e: any) => e.message).join(' ') : err?.response?.data?.message ?? 'Unable to create agent.');
    } finally {
      setCreating(false);
    }
  };

  const handleConfigSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedAgent) return;
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const originsList = configOriginsText.split('\n').map((s) => s.trim()).filter(Boolean);
      const updated = await updateAgent(selectedAgent.id, { ...configForm, allowedOrigins: originsList });
      setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setSaved(true);
    } catch (err: any) {
      setSaveError(err?.response?.data?.message ?? 'Unable to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedAgent) return;
    setActionError(null);
    try {
      const nextStatus = selectedAgent.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED';
      const updated = await updateAgent(selectedAgent.id, { status: nextStatus });
      setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch {
      setActionError(t.genericError);
    }
  };

  const handleDelete = async () => {
    if (!selectedAgent) return;
    if (!window.confirm(t.deleteConfirm)) return;
    setActionError(null);
    try {
      await deleteAgent(selectedAgent.id);
      setAgents((prev) => prev.filter((a) => a.id !== selectedAgent.id));
      setSelectedAgentId(null);
    } catch {
      setActionError(t.genericError);
    }
  };

  const handleAddKnowledge = async () => {
    if (!selectedAgentId || !newContent.trim()) return;
    setAddingKnowledge(true);
    setActionError(null);
    try {
      const doc = await createKnowledgeDocument(selectedAgentId, { question: newQuestion || null, content: newContent });
      setKnowledge((prev) => [doc, ...prev]);
      setNewQuestion('');
      setNewContent('');
    } catch {
      setActionError(t.genericError);
    } finally {
      setAddingKnowledge(false);
    }
  };

  const handleUploadKnowledgeFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedAgentId) return;
    setUploadingFile(true);
    setUploadFileError(null);
    try {
      const docs = await uploadKnowledgeFile(selectedAgentId, file);
      setKnowledge((prev) => [...docs, ...prev]);
    } catch (err: any) {
      setUploadFileError(err?.response?.data?.message ?? t.uploadFileError);
    } finally {
      setUploadingFile(false);
      if (knowledgeFileInputRef.current) knowledgeFileInputRef.current.value = '';
    }
  };

  const handleDeleteKnowledge = async (docId: string) => {
    if (!selectedAgentId) return;
    setActionError(null);
    try {
      await deleteKnowledgeDocument(selectedAgentId, docId);
      setKnowledge((prev) => prev.filter((d) => d.id !== docId));
    } catch {
      setActionError(t.genericError);
    }
  };

  const embedSnippet = selectedAgent
    ? `<script src="https://cdc.org.ge/widget.js" data-agent-id="${selectedAgent.id}" defer></script>`
    : '';

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(embedSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>;
  }

  if (agents.length === 0 && !showCreateForm) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-12 text-center">
        <Bot className="w-10 h-10 text-cyan-500 mx-auto mb-4" />
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t.noAgents}</p>
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl"
        >
          <Plus className="w-3.5 h-3.5" />
          {t.createFirst}
        </button>
      </div>
    );
  }

  if (showCreateForm) {
    return (
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-6 space-y-4 max-w-lg">
        <h2 className="text-sm font-bold flex items-center gap-2">
          <Bot className="w-4 h-4" />
          {t.newAgent}
        </h2>
        {createError && <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-xs text-red-600 dark:text-red-300">{createError}</div>}
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className={labelClass}>{t.name}</label>
            <input required className={inputClass} value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>{t.primaryColor}</label>
            <input type="color" className="h-10 w-20 rounded-lg border border-slate-300 dark:border-slate-700" value={createForm.primaryColor} onChange={(e) => setCreateForm({ ...createForm, primaryColor: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>{t.systemPrompt}</label>
            <textarea required rows={4} className={inputClass} value={createForm.systemPrompt} onChange={(e) => setCreateForm({ ...createForm, systemPrompt: e.target.value })} placeholder={t.systemPromptPlaceholder} />
          </div>
          <div>
            <label className={labelClass}>{t.allowedOrigins}</label>
            <textarea required rows={2} className={inputClass} value={createOriginsText} onChange={(e) => setCreateOriginsText(e.target.value)} placeholder={t.allowedOriginsPlaceholder} />
          </div>
          <div>
            <label className={labelClass}>{t.fallbackPhone}</label>
            <input className={inputClass} value={createForm.fallbackPhone ?? ''} onChange={(e) => setCreateForm({ ...createForm, fallbackPhone: e.target.value })} />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowCreateForm(false)} className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300">
              {t.cancel}
            </button>
            <button type="submit" disabled={creating} className="flex-1 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
              {creating ? t.creating : t.createButton}
            </button>
          </div>
        </form>
      </div>
    );
  }

  const SUB_NAV: { key: SubTab; label: string; icon: typeof Settings }[] = [
    { key: 'config', label: t.tabConfig, icon: Settings },
    { key: 'knowledge', label: t.tabKnowledge, icon: BookOpen },
    { key: 'embed', label: t.tabEmbed, icon: Code2 },
    { key: 'overview', label: t.tabOverview, icon: Info },
    { key: 'analytics', label: t.tabAnalytics, icon: BarChart3 },
  ];

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium px-4 py-2.5 flex items-center justify-between gap-3">
          {actionError}
          <button type="button" onClick={() => setActionError(null)} className="text-red-500/70 hover:text-red-500 font-bold">
            ×
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {agents.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelectedAgentId(a.id)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${
                selectedAgentId === a.id ? 'bg-slate-900 dark:bg-cyan-600 text-white border-transparent' : 'bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              {a.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl"
        >
          <Plus className="w-3.5 h-3.5" />
          {t.newAgent}
        </button>
      </div>

      {selectedAgent && (
        <>
          <div className="flex items-center gap-3">
            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${STATUS_BADGE[selectedAgent.status]}`}>
              {selectedAgent.status === 'TRIAL' ? t.trial : selectedAgent.status === 'ACTIVE' ? t.active : t.paused}
            </span>
            {selectedAgent.status === 'TRIAL' && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {t.trialEndsAt}: {new Date(selectedAgent.trialEndsAt).toLocaleDateString()}
              </span>
            )}
            <button
              type="button"
              onClick={handleToggleStatus}
              className="ml-auto text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center gap-1.5"
            >
              {selectedAgent.status === 'PAUSED' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              {selectedAgent.status === 'PAUSED' ? t.resume : t.pause}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t.delete}
            </button>
          </div>

          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            {SUB_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSubTab(item.key)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
                    subTab === item.key ? 'bg-slate-900 dark:bg-cyan-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>

          {subTab === 'config' && (
            <form onSubmit={handleConfigSave} className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-6 space-y-4 max-w-lg">
              {saveError && <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-xs text-red-600 dark:text-red-300">{saveError}</div>}
              <div>
                <label className={labelClass}>{t.name}</label>
                <input className={inputClass} value={configForm.name} onChange={(e) => setConfigForm({ ...configForm, name: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>{t.primaryColor}</label>
                <input type="color" className="h-10 w-20 rounded-lg border border-slate-300 dark:border-slate-700" value={configForm.primaryColor} onChange={(e) => setConfigForm({ ...configForm, primaryColor: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>{t.systemPrompt}</label>
                <textarea rows={4} className={inputClass} value={configForm.systemPrompt} onChange={(e) => setConfigForm({ ...configForm, systemPrompt: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>{t.allowedOrigins}</label>
                <textarea
                  rows={2}
                  className={inputClass}
                  value={configOriginsText}
                  onChange={(e) => setConfigOriginsText(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>{t.fallbackPhone}</label>
                <input className={inputClass} value={configForm.fallbackPhone ?? ''} onChange={(e) => setConfigForm({ ...configForm, fallbackPhone: e.target.value })} />
              </div>
              <button type="submit" disabled={saving} className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-60">
                {saving ? t.saving : saved ? t.saved : t.save}
              </button>
            </form>
          )}

          {subTab === 'knowledge' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.knowledgeHint}</p>
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-4 space-y-3">
                <input className={inputClass} placeholder={t.question} value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} />
                <textarea rows={2} className={inputClass} placeholder={t.content} value={newContent} onChange={(e) => setNewContent(e.target.value)} />
                <button
                  type="button"
                  disabled={addingKnowledge || !newContent.trim()}
                  onClick={handleAddKnowledge}
                  className="inline-flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl disabled:opacity-60"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t.addKnowledge}
                </button>
              </div>

              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-4 flex items-center gap-3">
                <UploadCloud className="w-5 h-5 text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t.uploadFileHint}</p>
                  {uploadFileError && <p className="text-xs text-red-600 mt-1">{uploadFileError}</p>}
                </div>
                <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 shrink-0">
                  {uploadingFile ? t.uploadingFile : t.uploadFile}
                  <input
                    ref={knowledgeFileInputRef}
                    type="file"
                    accept=".pdf,.docx,.md,.txt"
                    onChange={handleUploadKnowledgeFile}
                    className="hidden"
                    disabled={uploadingFile}
                  />
                </label>
              </div>

              {knowledge.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{t.noKnowledge}</p>
              ) : (
                <div className="space-y-2">
                  {knowledge.map((doc) => (
                    <div key={doc.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {doc.question && <p className="text-xs font-bold text-slate-900 dark:text-white mb-1">{doc.question}</p>}
                        <p className="text-xs text-slate-500 dark:text-slate-400">{doc.content}</p>
                      </div>
                      <button type="button" onClick={() => handleDeleteKnowledge(doc.id)} className="text-red-500 hover:text-red-600 bg-transparent border-none cursor-pointer shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {subTab === 'embed' && (
            <div className="space-y-4 max-w-2xl">
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-6 space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">{t.embedHint}</p>
                <pre className="rounded-lg bg-slate-950 text-slate-100 p-4 text-xs overflow-x-auto"><code>{embedSnippet}</code></pre>
                <button
                  type="button"
                  onClick={handleCopyEmbed}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? t.copied : t.copyCode}
                </button>
              </div>

              {/* Permanent Setup & Integration Guide — always visible under the
                  snippet, not a one-off tooltip, since a business owner may
                  come back to this tab weeks later to hand it to a developer. */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none p-6">
                <h3 className="text-sm font-black tracking-wide mb-4">{t.setupGuideTitle}</h3>
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">
                  {([
                    ['wordpress', t.setupWordpress],
                    ['shopify', t.setupShopify],
                    ['html', t.setupHtml],
                  ] as [SetupGuidePlatform, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSetupPlatform(key)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
                        setupPlatform === key
                          ? 'bg-slate-900 dark:bg-cyan-600 text-white'
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <ol className="space-y-2.5 list-decimal list-inside">
                  {(setupPlatform === 'wordpress'
                    ? t.setupWordpressSteps
                    : setupPlatform === 'shopify'
                    ? t.setupShopifySteps
                    : t.setupHtmlSteps
                  ).map((step) => (
                    <li key={step} className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          {subTab === 'overview' && (
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none p-6 max-w-2xl">
              <ProductOverviewCard
                lang={lang}
                icon={Bot}
                title={t.title}
                tagline={t.subtitle}
                {...PRODUCT_OVERVIEW[lang].enterpriseAi}
              />
            </div>
          )}

          {subTab === 'analytics' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.analyticsHint}</p>
              {conversations.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{t.noConversations}</p>
              ) : (
                <div className="space-y-2">
                  {conversations.map((c) => (
                    <div key={c.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{c.visitorRef.slice(0, 12)}…</span>
                        <span className="text-[11px] text-slate-400">{new Date(c.createdAt).toLocaleString()} · {c.messages.length} {t.messages}</span>
                      </div>
                      {c.messages.slice(-2).map((m) => (
                        <p key={m.id} className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          <span className="font-bold">{m.role === 'USER' ? '→' : '←'}</span> {m.content}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
