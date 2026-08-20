import { useState, useEffect, useCallback, FormEvent, Fragment } from 'react';
import Head from 'next/head';
import { ExternalLink, RefreshCw, Settings, ChevronDown, ChevronUp, Trash2, Plus } from 'lucide-react';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import {
  getOpportunities,
  updateOpportunity,
  rescanOpportunities,
  getGrantSources,
  createGrantSource,
  updateGrantSource,
  deleteGrantSource,
  GrantSourcePayload,
} from '../../src/services/opportunityService';
import { GrantOpportunity, GrantSource, GrantEligibilityStatus } from '../../src/types/opportunity';

const STATUS_BADGE: Record<GrantEligibilityStatus, string> = {
  ELIGIBLE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  NOT_ELIGIBLE: 'bg-red-50 text-red-700 border-red-200',
  NEEDS_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
};
const STATUS_LABEL: Record<GrantEligibilityStatus, string> = {
  ELIGIBLE: 'შესაფერისი',
  NOT_ELIGIBLE: 'არ შეესაბამება',
  NEEDS_REVIEW: 'საჭიროებს განხილვას',
};

function DeadlineBadge({ deadline }: { deadline: string | null }) {
  if (!deadline) return <span className="text-xs text-gray-400">ვადა არ არის მითითებული</span>;
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const color = days < 0 ? 'bg-gray-100 text-gray-500 border-gray-200' : days <= 7 ? 'bg-red-50 text-red-700 border-red-200' : days <= 30 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-gray-50 text-gray-600 border-gray-200';
  const label = days < 0 ? 'ვადა გავიდა' : days === 0 ? 'დღეს იწურება' : `${days} დღეში`;
  return (
    <span className={`inline-flex flex-col items-start gap-0.5`}>
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${color}`}>{label}</span>
      <span className="text-[11px] text-gray-400">{new Date(deadline).toLocaleDateString('ka-GE')}</span>
    </span>
  );
}

function formatBudget(o: GrantOpportunity): string {
  if (!o.budgetMin && !o.budgetMax) return '—';
  const cur = o.budgetCurrency ?? '';
  if (o.budgetMin && o.budgetMax && o.budgetMin !== o.budgetMax) return `${o.budgetMin.toLocaleString()}–${o.budgetMax.toLocaleString()} ${cur}`;
  return `${(o.budgetMax ?? o.budgetMin)!.toLocaleString()} ${cur}`;
}

function SourcesModal({ onClose }: { onClose: () => void }) {
  const [sources, setSources] = useState<GrantSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', baseUrl: '', listingUrls: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getGrantSources()
      .then(setSources)
      .catch(() => setError('წყაროების ჩატვირთვა ვერ მოხერხდა.'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => load(), [load]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload: GrantSourcePayload = {
        name: form.name.trim(),
        baseUrl: form.baseUrl.trim(),
        listingUrls: form.listingUrls.split('\n').map((l) => l.trim()).filter(Boolean),
      };
      await createGrantSource(payload);
      setForm({ name: '', baseUrl: '', listingUrls: '' });
      load();
    } catch {
      setError('წყაროს დამატება ვერ მოხერხდა — შეამოწმეთ URL-ები.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (source: GrantSource) => {
    await updateGrantSource(source.id, { isActive: !source.isActive });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('წავშალო ეს წყარო? ადრე ნაპოვნი შესაძლებლობები დარჩება.')) return;
    await deleteGrantSource(id);
    load();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">სკანირების წყაროები</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer text-xl leading-none">×</button>
        </div>

        {error && <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        <div className="space-y-3 mb-6">
          {loading ? (
            <div className="text-sm text-gray-400">იტვირთება…</div>
          ) : sources.length === 0 ? (
            <div className="text-sm text-gray-400">წყაროები არ არის დამატებული.</div>
          ) : (
            sources.map((s) => (
              <div key={s.id} className="border border-gray-200 dark:border-slate-700 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">{s.name}</div>
                    <div className="text-xs text-gray-400 truncate">{s.baseUrl}</div>
                    <div className="text-[11px] text-gray-400 mt-1">
                      {s.lastScanAt ? `ბოლო სკანირება: ${new Date(s.lastScanAt).toLocaleString('ka-GE')} (${s.lastScanStatus})` : 'ჯერ არ დასკანირებულა'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleActive(s)}
                      className={`text-[11px] font-bold px-2 py-1 rounded-full border cursor-pointer ${s.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
                    >
                      {s.isActive ? 'აქტიური' : 'გათიშული'}
                    </button>
                    <button type="button" onClick={() => handleDelete(s.id)} className="text-red-400 hover:text-red-600 bg-transparent border-none cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleAdd} className="border-t border-gray-200 dark:border-slate-700 pt-4 space-y-2">
          <div className="text-sm font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-1.5"><Plus className="w-4 h-4" /> ახალი წყარო</div>
          <input required placeholder="სახელი (მაგ. grantebi.ge)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" />
          <input required placeholder="baseUrl (მაგ. https://grantebi.ge)" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" />
          <textarea required placeholder="listing URL-ები, თითო ხაზზე" rows={3} value={form.listingUrls} onChange={(e) => setForm({ ...form, listingUrls: e.target.value })} className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" />
          <button type="submit" disabled={submitting} className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-sm font-bold py-2 rounded-lg disabled:opacity-50">
            {submitting ? 'ემატება…' : 'დამატება'}
          </button>
        </form>
      </div>
    </div>
  );
}

function AdminOpportunitiesDashboard() {
  const [opportunities, setOpportunities] = useState<GrantOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<GrantEligibilityStatus | 'ALL'>('ALL');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rescanning, setRescanning] = useState(false);
  const [rescanMessage, setRescanMessage] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getOpportunities({ eligibilityStatus: filter === 'ALL' ? undefined : filter, includeArchived })
      .then(setOpportunities)
      .catch(() => setError('შესაძლებლობების ჩატვირთვა ვერ მოხერხდა.'))
      .finally(() => setLoading(false));
  }, [filter, includeArchived]);

  useEffect(() => load(), [load]);

  const handleRescan = async () => {
    setRescanning(true);
    setRescanMessage(null);
    try {
      const result = await rescanOpportunities();
      setRescanMessage(result.message);
      load();
    } catch {
      setRescanMessage('სკანირება ვერ მოხერხდა.');
    } finally {
      setRescanning(false);
    }
  };

  const handleArchive = async (o: GrantOpportunity) => {
    await updateOpportunity(o.id, { isArchived: !o.isArchived });
    load();
  };

  const handleOverride = async (o: GrantOpportunity, status: GrantEligibilityStatus) => {
    await updateOpportunity(o.id, { eligibilityStatus: status });
    load();
  };

  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <Head><title>გრანტები & ტენდერები — CDC Admin</title></Head>
      <AdminLayout>
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">გრანტების & ტენდერების სკაუტი</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">ყოველდღიურად სკანირებული დაფინანსების შესაძლებლობები, AI-ის მიერ შეფასებული საქართველოს/CDC-ის შესაბამისობაზე.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSourcesOpen(true)} className="flex items-center gap-1.5 text-sm font-semibold border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 px-3 py-2 rounded-lg bg-white dark:bg-slate-800">
              <Settings className="w-4 h-4" /> წყაროების მართვა
            </button>
            <button onClick={handleRescan} disabled={rescanning} className="flex items-center gap-1.5 text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-purple-600 px-3 py-2 rounded-lg disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${rescanning ? 'animate-spin' : ''}`} /> {rescanning ? 'სკანირება მიმდინარეობს…' : 'სკანირება ახლავე'}
            </button>
          </div>
        </div>

        {rescanMessage && <div className="mb-4 text-sm bg-cyan-50 border border-cyan-200 text-cyan-800 rounded-lg px-3 py-2">{rescanMessage}</div>}

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {(['ALL', 'ELIGIBLE', 'NEEDS_REVIEW', 'NOT_ELIGIBLE'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full border cursor-pointer ${filter === f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-600'}`}
            >
              {f === 'ALL' ? 'ყველა' : STATUS_LABEL[f]}
            </button>
          ))}
          <label className="ml-2 flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 cursor-pointer">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} /> დაარქივებულის ჩვენება
          </label>
        </div>

        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">იტვირთება…</div>
          ) : opportunities.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">შესაძლებლობები ვერ მოიძებნა.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800/50 text-left text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-semibold">დასახელება</th>
                  <th className="px-4 py-3 font-semibold">ორგანიზაცია</th>
                  <th className="px-4 py-3 font-semibold">ვადა</th>
                  <th className="px-4 py-3 font-semibold">ბიუჯეტი</th>
                  <th className="px-4 py-3 font-semibold">სტატუსი</th>
                  <th className="px-4 py-3 font-semibold text-right">მოქმედებები</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((o) => (
                  <Fragment key={o.id}>
                    <tr className={`border-t border-gray-100 dark:border-slate-800 ${o.isArchived ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setExpandedId(expandedId === o.id ? null : o.id)} className="text-gray-400 bg-transparent border-none cursor-pointer shrink-0">
                            {expandedId === o.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 dark:text-white truncate">{o.title}</div>
                            <a href={o.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-cyan-600 hover:underline flex items-center gap-1">
                              {o.source.name} <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{o.organization ?? '—'}</td>
                      <td className="px-4 py-3"><DeadlineBadge deadline={o.deadline} /></td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-300 whitespace-nowrap">{formatBudget(o)}</td>
                      <td className="px-4 py-3">
                        <select
                          value={o.eligibilityStatus}
                          onChange={(e) => handleOverride(o, e.target.value as GrantEligibilityStatus)}
                          className={`text-xs font-bold px-2 py-1 rounded-full border cursor-pointer ${STATUS_BADGE[o.eligibilityStatus]}`}
                        >
                          {(['ELIGIBLE', 'NEEDS_REVIEW', 'NOT_ELIGIBLE'] as const).map((s) => (
                            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleArchive(o)} className="text-xs font-semibold text-gray-500 hover:text-gray-800 dark:hover:text-white bg-transparent border-none cursor-pointer">
                          {o.isArchived ? 'აღდგენა' : 'დაარქივება'}
                        </button>
                      </td>
                    </tr>
                    {expandedId === o.id && (
                      <tr className="bg-gray-50 dark:bg-slate-800/30">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="grid md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="font-semibold text-gray-700 dark:text-slate-300 mb-1">AI შეჯამება</div>
                              <div className="whitespace-pre-line text-gray-600 dark:text-slate-400">{o.summary}</div>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <span className="font-semibold text-gray-700 dark:text-slate-300">🇬🇪 საქართველოს შესაბამისობა: </span>
                                <span className="text-gray-600 dark:text-slate-400">{o.georgiaEligible === null ? 'გაურკვეველია' : o.georgiaEligible ? 'დიახ' : 'არა'} — {o.georgiaEligibleReason}</span>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-700 dark:text-slate-300">🎯 CDC-ის სფეროს შესაბამისობა: </span>
                                <span className="text-gray-600 dark:text-slate-400">{o.scopeMatch === null ? 'გაურკვეველია' : o.scopeMatch ? 'დიახ' : 'არა'} — {o.scopeMatchReason}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {sourcesOpen && <SourcesModal onClose={() => { setSourcesOpen(false); load(); }} />}
      </AdminLayout>
    </AdminGuard>
  );
}

export default AdminOpportunitiesDashboard;
