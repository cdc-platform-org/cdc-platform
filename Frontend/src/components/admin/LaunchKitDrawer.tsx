import { useState, useEffect, useCallback } from 'react';
import { X, Copy, Check, RefreshCw, Sparkles } from 'lucide-react';
import { generateLaunchKit, getLaunchKits, deleteLaunchKit } from '../../services/marketingService';
import { generateMyLaunchKit, getMyLaunchKits, deleteMyLaunchKit } from '../../services/creatorMarketingService';
import { LaunchKit } from '../../types/marketing';
import VideoTutorialLink from '../shared/VideoTutorialLink';

type Target = { productId: string } | { courseId: string };

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="shrink-0 text-gray-400 hover:text-cyan-600 bg-transparent border-none cursor-pointer"
      title="კოპირება"
    >
      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-gray-200 dark:border-slate-700 rounded-xl p-3">
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</span>
        <CopyButton text={value} />
      </div>
      <div className="text-sm text-gray-800 dark:text-slate-200 whitespace-pre-wrap">{value}</div>
    </div>
  );
}

const TABS = ['social', 'b2b', 'audience'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { social: 'სოც. მედია', b2b: 'B2B აუთრიჩი', audience: 'აუდიტორია' };

export default function LaunchKitDrawer({
  target,
  title,
  onClose,
  scope = 'admin',
}: {
  target: Target;
  title: string;
  onClose: () => void;
  // 'admin' (default) hits /admin/marketing — any SUPER_ADMIN/MANAGER may
  // target any product/course. 'creator' hits /instructor/marketing — the
  // backend restricts it to the calling user's own product (submittedById)
  // or course (instructorId); a non-owner gets a 404 the caller should
  // never be able to trigger in the first place, since creator call sites
  // only ever render this drawer for the current user's own items. Same
  // modal UI either way — only which endpoints it calls differs.
  scope?: 'admin' | 'creator';
}) {
  const [kits, setKits] = useState<LaunchKit[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('social');
  const [lang, setLang] = useState<'ka' | 'en'>('ka');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchKits = scope === 'creator' ? getMyLaunchKits : getLaunchKits;
  const doGenerate = scope === 'creator' ? generateMyLaunchKit : generateLaunchKit;
  const doDelete = scope === 'creator' ? deleteMyLaunchKit : deleteLaunchKit;

  const load = useCallback(() => {
    setLoading(true);
    fetchKits(target)
      .then((data) => {
        setKits(data);
        // Keep the current selection if it still exists (e.g. after a
        // delete elsewhere in the list); otherwise default to the newest.
        setSelectedId((current) => (current && data.some((k) => k.id === current) ? current : data[0]?.id ?? null));
      })
      .catch(() => setError('კომპლექტების ჩატვირთვა ვერ მოხერხდა.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(target), scope]);

  useEffect(() => load(), [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const created = await doGenerate(target, lang);
      await load();
      setSelectedId(created.id);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'გენერაცია ვერ მოხერხდა — სცადეთ თავიდან.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setError(null);
    try {
      await doDelete(id);
      await load();
    } catch {
      setError('წაშლა ვერ მოხერხდა — სცადეთ თავიდან.');
    } finally {
      setDeletingId(null);
    }
  };

  const latest = kits.find((k) => k.id === selectedId) ?? kits[0];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 h-full w-full max-w-xl overflow-y-auto p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-purple-500" /> გაყიდვების Launch Kit</h2>
            <p className="text-xs text-gray-400 mt-0.5">{title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer text-xl leading-none">×</button>
        </div>

        <div className="flex justify-end mb-3">
          <VideoTutorialLink lang="ka" />
        </div>

        {error && <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-bold text-gray-400">სამიზნე ბაზრის ენა</span>
          <div className="flex rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
            {(['ka', 'en'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={`px-3 py-1 text-xs font-bold ${lang === l ? 'bg-cyan-500 text-white' : 'bg-transparent text-gray-500 dark:text-slate-400'} border-none cursor-pointer`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full mb-4 flex items-center justify-center gap-1.5 text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-purple-600 px-3 py-2.5 rounded-lg disabled:opacity-50"
        >
          {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating ? 'იქმნება…' : latest ? 'ხელახლა გენერირება' : 'Launch Kit-ის გენერირება'}
        </button>

        {loading ? (
          <div className="text-sm text-gray-400 text-center py-8">იტვირთება…</div>
        ) : !latest ? (
          <div className="text-sm text-gray-400 text-center py-8">ჯერ არ არის გენერირებული. დააჭირეთ ღილაკს ზემოთ.</div>
        ) : (
          <div>
            {kits.length > 1 && (
              <div className="space-y-1.5 mb-4">
                {kits.map((k) => (
                  <div
                    key={k.id}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
                      k.id === selectedId ? 'border-cyan-400/60 bg-cyan-50 dark:bg-cyan-500/10' : 'border-gray-200 dark:border-slate-700'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(k.id)}
                      className="flex-1 text-left bg-transparent border-none cursor-pointer text-gray-600 dark:text-slate-300"
                    >
                      {new Date(k.createdAt).toLocaleString('ka-GE')} · {k.lang.toUpperCase()}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(k.id)}
                      disabled={deletingId === k.id}
                      className="shrink-0 text-red-500 hover:text-red-600 bg-transparent border-none cursor-pointer disabled:opacity-50"
                    >
                      {deletingId === k.id ? 'იშლება…' : 'წაშლა'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="text-[11px] text-gray-400 mb-3">გენერირებულია: {new Date(latest.createdAt).toLocaleString('ka-GE')} · {kits.length > 1 ? `${kits.length} ვერსია ისტორიაში` : 'პირველი ვერსია'}</div>

            <div className="flex gap-1 mb-4 border-b border-gray-200 dark:border-slate-700">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-2 text-sm font-semibold border-b-2 bg-transparent cursor-pointer ${tab === t ? 'border-cyan-500 text-cyan-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                  {TAB_LABEL[t]}
                </button>
              ))}
            </div>

            {tab === 'social' && (
              <div className="space-y-3">
                {latest.socialPosts.map((p, i) => (
                  <Field
                    key={i}
                    label={`${p.platform === 'facebook' ? 'Facebook' : 'Instagram'}`}
                    value={`${p.hook}\n\n${p.body}\n\n${p.cta}\n\n${p.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}`}
                  />
                ))}
              </div>
            )}

            {tab === 'b2b' && (
              <div className="space-y-3">
                <Field label="LinkedIn პოსტი" value={latest.linkedinPost} />
                <Field label={`გაყიდვის ემეილი — ${latest.salesEmailSubject}`} value={`${latest.salesEmailSubject}\n\n${latest.salesEmailBody}`} />
              </div>
            )}

            {tab === 'audience' && (
              <div className="space-y-3">
                <Field label="დემოგრაფია" value={latest.audienceProfile.demographics.map((d) => `- ${d}`).join('\n')} />
                <Field label="პოზიციონირება" value={latest.audienceProfile.positioning.map((d) => `- ${d}`).join('\n')} />
                <Field label="რეკომენდირებული არხები" value={latest.audienceProfile.recommendedChannels.map((d) => `- ${d}`).join('\n')} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
