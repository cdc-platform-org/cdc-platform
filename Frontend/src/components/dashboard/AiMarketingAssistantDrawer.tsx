import { useState, useEffect, useCallback } from 'react';
import { Crown, Sparkles, RefreshCw, Copy, Check, X } from 'lucide-react';
import {
  generateProductMarketingCopy,
  getMarketingAssistantUsage,
  ProductMarketingCopy,
  MarketingGenerationUsage,
} from '../../services/marketingAssistantService';

// VIP-styled quick-assist AI marketing copy generator for the digital
// products dashboard tab (Frontend/pages/dashboard.tsx). Deliberately a
// separate, lighter component from LaunchKitDrawer.tsx (full campaign kit —
// social posts per platform, audience profile, sales email, unmetered) —
// this one is a single-call title/description/social-copy/tags generator
// metered at 5/24h (Backend/src/routes/ai.ts's /ai/digital-store-marketing),
// meant to live right inside the product form itself. No existing "VIP"
// visual language exists elsewhere in this codebase yet (confirmed before
// building this) — the gold/purple gradient + Crown badge introduced here
// is new, layered on top of the house AI gradient
// (from-cyan-500 to-purple-600, see CourseTutorPanel/LaunchKitDrawer) so it
// still reads as "an AI feature" while standing out as the premium one.

const DICT_BASE = {
  ka: {
    trigger: 'AI მარკეტინგული ასისტენტი',
    triggerSub: 'AI Launch Kit',
    heading: 'AI მარკეტინგული ასისტენტი',
    subheading: 'AI Launch Kit — 1-კლიკით სათაური, აღწერა, სოც. მედია პოსტი და თეგები',
    usageLabel: 'VIP AI ლიმიტი',
    usageToday: 'დღეს',
    generate: 'გენერირება',
    regenerate: 'ხელახლა გენერირება',
    generating: 'იქმნება…',
    loadingUsage: 'იტვირთება…',
    usageUnavailable: 'ხელმისაწვდომი არ არის',
    limitReached: 'დღიური ლიმიტი ამოწურულია — სცადეთ ხვალ.',
    needTitle: 'გენერაციისთვის საჭიროა სათაური და აღწერა.',
    genericError: 'გენერაცია ვერ მოხერხდა — სცადეთ თავიდან.',
    authError: 'საჭიროა ავტორიზაცია — გთხოვთ, თავიდან შეხვიდეთ სისტემაში.',
    fieldTitle: 'სათაური',
    fieldDescription: 'აღწერა',
    fieldSocial: 'სოც. მედია პოსტი',
    fieldTags: 'თეგები',
    apply: 'გამოყენება ფორმაში',
    applied: 'დაემატა',
    close: 'დახურვა',
  },
  en: {
    trigger: 'AI Marketing Assistant',
    triggerSub: 'AI Launch Kit',
    heading: 'AI Marketing Assistant',
    subheading: 'AI Launch Kit — 1-click title, description, social post & tags',
    usageLabel: 'VIP AI Limit',
    usageToday: 'today',
    generate: 'Generate',
    regenerate: 'Regenerate',
    generating: 'Generating…',
    loadingUsage: 'Loading…',
    usageUnavailable: 'unavailable',
    limitReached: 'Daily limit reached — try again tomorrow.',
    needTitle: 'Title and description are required to generate.',
    genericError: 'Generation failed — please try again.',
    authError: 'Please sign in again to continue.',
    fieldTitle: 'Title',
    fieldDescription: 'Description',
    fieldSocial: 'Social post',
    fieldTags: 'Tags',
    apply: 'Apply to form',
    applied: 'Applied',
    close: 'Close',
  },
} as const;

type Locale = keyof typeof DICT_BASE | string;

function dict(lang: Locale) {
  return lang === 'ka' ? DICT_BASE.ka : DICT_BASE.en;
}

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
      className="shrink-0 text-slate-400 hover:text-amber-500 bg-transparent border-none cursor-pointer"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

interface AiMarketingAssistantDrawerProps {
  title: string;
  description: string;
  category: string;
  productId?: string;
  lang: Locale;
  onApplyTitle: (value: string) => void;
  onApplyDescription: (value: string) => void;
  onClose: () => void;
}

export default function AiMarketingAssistantDrawer({
  title,
  description,
  category,
  productId,
  lang,
  onApplyTitle,
  onApplyDescription,
  onClose,
}: AiMarketingAssistantDrawerProps) {
  const d = dict(lang);
  const requestLang: 'ka' | 'en' = lang === 'ka' ? 'ka' : 'en';
  const [usage, setUsage] = useState<MarketingGenerationUsage | null>(null);
  const [usageError, setUsageError] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProductMarketingCopy | null>(null);
  const [appliedTitle, setAppliedTitle] = useState(false);
  const [appliedDescription, setAppliedDescription] = useState(false);

  useEffect(() => {
    // Distinguish "fetch failed" from "still fetching" — an unguarded
    // `.catch(() => {})` here previously left the badge reading "Loading…"
    // forever on any failure, with no way to tell the two states apart.
    let cancelled = false;
    getMarketingAssistantUsage()
      .then((u) => {
        if (!cancelled) setUsage(u);
      })
      .catch(() => {
        if (!cancelled) setUsageError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const atLimit = !!usage && usage.used >= usage.limit;

  // Builds a readable message from a plain zod-validation 400 (`{errors}`,
  // no `.message`) — e.g. category left blank server-side too, or a title/
  // description length violation — rather than always falling through to
  // the generic failure string, which gave no clue what was actually wrong.
  const describeError = useCallback(
    (err: any): string => {
      if (err?.response?.data?.message) return err.response.data.message;
      const zodErrors = err?.response?.data?.errors;
      if (Array.isArray(zodErrors) && zodErrors.length > 0) {
        return zodErrors.map((e: any) => e.message).filter(Boolean).join(' ');
      }
      if (err?.response?.status === 401 || err?.response?.status === 403) return d.authError;
      return d.genericError;
    },
    [d]
  );

  const handleGenerate = useCallback(async () => {
    // category is intentionally not required here — the backend now
    // falls back to a generic category context when it's left blank, so a
    // brand-new draft (title + description only) can still generate.
    if (!title.trim() || !description.trim()) {
      setError(d.needTitle);
      return;
    }
    setGenerating(true);
    setError(null);
    setAppliedTitle(false);
    setAppliedDescription(false);
    try {
      const response = await generateProductMarketingCopy({ title, description, category, lang: requestLang, productId });
      setResult(response.data);
      setUsage(response.usage);
      setUsageError(false);
    } catch (err: any) {
      if (err?.response?.status === 429) {
        setUsage(err.response.data?.usage ?? usage);
        setError(err.response.data?.message || d.limitReached);
      } else {
        setError(describeError(err));
      }
    } finally {
      setGenerating(false);
    }
  }, [title, description, category, requestLang, productId, d, usage, describeError]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={onClose}>
      <div
        className="relative h-full w-full max-w-lg overflow-y-auto p-6 shadow-2xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-l border-amber-400/20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full bg-purple-600/20 blur-3xl" />
        <div className="pointer-events-none absolute top-40 -left-16 w-56 h-56 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="relative flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-400 via-purple-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-500/40 ring-1 ring-amber-300/40">
              <Crown className="w-5 h-5 text-white drop-shadow" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" /> {d.heading}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">{d.subheading}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white bg-transparent border-none cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative flex items-center justify-between gap-3 mb-5 rounded-xl border border-amber-400/30 bg-gradient-to-r from-amber-400/10 via-purple-500/10 to-cyan-500/10 px-3.5 py-2.5">
          <span className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
            <Crown className="w-3.5 h-3.5" /> {d.usageLabel}
          </span>
          <span className="text-xs font-bold text-white">
            {usage ? `${usage.used}/${usage.limit} ${d.usageToday}` : usageError ? d.usageUnavailable : d.loadingUsage}
          </span>
        </div>

        {error && (
          <div className="relative mb-4 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || atLimit}
          className="relative w-full mb-5 flex items-center justify-center gap-2 text-sm font-bold text-white bg-gradient-to-r from-amber-400 via-purple-500 to-cyan-500 px-4 py-3 rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-shadow disabled:opacity-50 disabled:shadow-none border-none cursor-pointer"
        >
          {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating ? d.generating : result ? d.regenerate : d.generate}
        </button>

        {result && (
          <div className="relative space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wide text-amber-300/80">{d.fieldTitle}</span>
                <div className="flex items-center gap-2">
                  <CopyButton text={result.title} />
                  <button
                    type="button"
                    onClick={() => {
                      onApplyTitle(result.title);
                      setAppliedTitle(true);
                    }}
                    className="text-[10px] font-bold uppercase px-2 py-1 rounded-md bg-gradient-to-r from-amber-400 to-purple-500 text-white border-none cursor-pointer disabled:opacity-60"
                    disabled={appliedTitle}
                  >
                    {appliedTitle ? d.applied : d.apply}
                  </button>
                </div>
              </div>
              <p className="text-sm text-slate-100">{result.title}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wide text-amber-300/80">{d.fieldDescription}</span>
                <div className="flex items-center gap-2">
                  <CopyButton text={result.description} />
                  <button
                    type="button"
                    onClick={() => {
                      onApplyDescription(result.description);
                      setAppliedDescription(true);
                    }}
                    className="text-[10px] font-bold uppercase px-2 py-1 rounded-md bg-gradient-to-r from-amber-400 to-purple-500 text-white border-none cursor-pointer disabled:opacity-60"
                    disabled={appliedDescription}
                  >
                    {appliedDescription ? d.applied : d.apply}
                  </button>
                </div>
              </div>
              <p className="text-sm text-slate-100 whitespace-pre-wrap">{result.description}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wide text-amber-300/80">{d.fieldSocial}</span>
                <CopyButton text={result.socialCopy} />
              </div>
              <p className="text-sm text-slate-100 whitespace-pre-wrap">{result.socialCopy}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-amber-300/80">{d.fieldTags}</span>
                <CopyButton text={result.tags.join(', ')} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.tags.map((tag) => (
                  <span key={tag} className="text-[11px] font-semibold px-2 py-1 rounded-full bg-gradient-to-r from-amber-400/20 to-purple-500/20 text-amber-200 border border-amber-400/30">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
