import { useState } from 'react';
import Link from 'next/link';
import { Lock, Clock, FileText, TrendingUp, MessageCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { hasAiAgentsSuiteAccess, aiTrialDaysRemaining, generateWithAiAgent, AiAgentSuiteTool } from '../../services/aiAgentsSuiteService';
import { SupportedLocale } from '../../utils/locale';

const dictBase = {
  ka: {
    title: 'Business AI Agents',
    subtitle: 'მზა AI ინსტრუმენტები თქვენი ბიზნესისთვის — კონტენტი, ბაზრის ანალიზი და ზოგადი დახმარება.',
    trialActive: (days: number) => `თქვენი უფასო 7-დღიანი საცდელი პერიოდი აქტიურია (დარჩენილია ${days} დღე)`,
    trialExpired: 'თქვენი საცდელი პერიოდი ამოიწურა — დაუკავშირდით CDC-ს გასაგრძელებლად.',
    verificationPending:
      'საჯარო რეესტრის ამონაწერი განხილვის პროცესშია. AI ინსტრუმენტები და 7-დღიანი საცდელი ვადა გააქტიურდება ადმინისტრაციის დადასტურებისთანავე.',
    unlimited: 'შეუზღუდავი წვდომა აქტიურია',
    contactUs: 'დაგვიკავშირდით',
    contentTitle: 'B2B კონტენტ გენერატორი',
    contentDesc: 'მარკეტინგული ტექსტები, სოციალური ქსელის პოსტები, პროდუქტის აღწერები.',
    contentPlaceholder: 'მაგ: დაწერე პოსტი Facebook-სთვის ჩვენი ახალი პროდუქტის შესახებ...',
    analyticsTitle: 'ბაზრის ანალიტიკის აგენტი',
    analyticsDesc: 'ბაზრის ტენდენციები, კონკურენტული პოზიციონირება, ინდუსტრიის მიმოხილვა.',
    analyticsPlaceholder: 'მაგ: რა ტენდენციებია ციფრული მარკეტინგის ბაზარზე საქართველოში?',
    assistantTitle: 'ბიზნეს ასისტენტი',
    assistantDesc: 'ელფოსტების მომზადება, იდეების სტრუქტურირება, ზოგადი ბიზნეს კითხვები.',
    assistantPlaceholder: 'მაგ: დამეხმარე დავწერო ელფოსტა კლიენტისთვის ვადის გადაწევის შესახებ...',
    generate: 'გენერირება',
    generating: 'მუშავდება…',
    locked: 'ხელმისაწვდომია აქტიური საცდელი/გამოწერით',
    error: 'დაფიქსირდა შეცდომა. სცადეთ თავიდან.',
    learnMore: 'გაიგეთ მეტი',
  },
  en: {
    title: 'Business AI Agents',
    subtitle: 'Ready-made AI tools for your business — content, market analysis, and general assistance.',
    trialActive: (days: number) => `Your free 7-day trial is active (${days} day${days === 1 ? '' : 's'} remaining)`,
    trialExpired: 'Your trial has expired — contact CDC to continue.',
    verificationPending:
      'Your public registry extract is under review. AI tools and the 7-day trial will activate as soon as our team approves it.',
    unlimited: 'Unlimited access active',
    contactUs: 'Contact Us',
    contentTitle: 'B2B Content Generator',
    contentDesc: 'Marketing copy, social media posts, product descriptions.',
    contentPlaceholder: 'e.g. Write a Facebook post about our new product...',
    analyticsTitle: 'Market Analytics Agent',
    analyticsDesc: 'Market trends, competitive positioning, industry overview.',
    analyticsPlaceholder: 'e.g. What are the current trends in digital marketing in Georgia?',
    assistantTitle: 'Business Assistant',
    assistantDesc: 'Draft emails, structure ideas, general business questions.',
    assistantPlaceholder: 'e.g. Help me write an email to a client about a deadline extension...',
    generate: 'Generate',
    generating: 'Generating…',
    locked: 'Available with an active trial/subscription',
    error: 'Something went wrong. Please try again.',
    learnMore: 'Learn more',
  },
};

// English fallback for locales without a translation yet.
const dict: Record<SupportedLocale, typeof dictBase.en> = {
  ...dictBase,
  de: dictBase.en,
  es: dictBase.en,
  fr: dictBase.en,
  uk: dictBase.en,
};

function AiToolCard({
  tool,
  icon: Icon,
  title,
  description,
  placeholder,
  locked,
  lang,
}: {
  tool: AiAgentSuiteTool;
  icon: typeof FileText;
  title: string;
  description: string;
  placeholder: string;
  locked: boolean;
  lang: SupportedLocale;
}) {
  const t = dict[lang];
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim() || locked) return;
    setLoading(true);
    setError(null);
    try {
      // generateWithAiAgent is typed 'ka' | 'en' — flagged separately as an
      // external sink (see report). Same "bilingual-only" boundary as the
      // rest of this i18n pass: non-ka/en locales get English content.
      setResult(await generateWithAiAgent(tool, prompt.trim(), lang === 'ka' ? 'ka' : 'en'));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 backdrop-blur-md bg-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-6 hover:border-purple-500/40 transition-all flex flex-col">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 via-pink-500 to-cyan-500 flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(168,85,247,0.3)]">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-sm font-extrabold tracking-wide text-white">{t.assistantTitle}</h3>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        {t.assistantDesc}
      </p>

      {locked ? (
        <div className="mt-auto flex items-center gap-2 text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3.5 py-3">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          {t.locked}
        </div>
      ) : (
        <>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/60 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-purple-500/60 mb-3"
          />
          {error && <p className="text-[11px] text-rose-600 dark:text-rose-400 mb-2">{error}</p>}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2.5 rounded-xl border-none cursor-pointer hover:opacity-90 disabled:opacity-50 mb-3 shadow-[0_4px_12px_rgba(168,85,247,0.3)]"
          >
            {loading ? t.generating : t.generate}
          </button>
          <Link
            href="/about"
            className="text-xs font-bold text-purple-500 hover:underline"
          >
            {t.learnMore}
          </Link>
          {result && (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 px-3.5 py-3 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
              {result}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function BusinessAiAgentsSuite({ lang }: { lang: SupportedLocale }) {
  const t = dict[lang];
  const { user } = useAuth();
  const hasAccess = hasAiAgentsSuiteAccess(user);
  const daysRemaining = user ? aiTrialDaysRemaining(user.aiTrialEndsAt) : 0;
  const unlimited = !!user?.aiSubscriptionActive || user?.role === 'SuperAdmin';
  // A Client who's never been verified (or is under review) hasn't "expired"
  // a trial — they've never had one yet. Distinct messaging + no false
  // "contact us to renew" CTA for that case.
  const verificationPending =
    !hasAccess && user?.role === 'Client' && user.verificationStatus !== 'APPROVED' && user.verificationStatus !== 'REJECTED';

  return (
    <div className="mb-10">
      <div className="mb-4">
        <h2 className="text-lg font-black tracking-wide">{t.title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.subtitle}</p>
      </div>

      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4 mb-5 ${
          hasAccess
            ? 'border-cyan-500/30 bg-cyan-500/5'
            : 'border-amber-500/30 bg-amber-500/5'
        }`}
      >
        <p className={`flex items-center gap-2 text-sm font-bold ${hasAccess ? 'text-cyan-700 dark:text-cyan-400' : 'text-amber-700 dark:text-amber-400'}`}>
          <Clock className="w-4 h-4 shrink-0" />
          {unlimited ? t.unlimited : hasAccess ? t.trialActive(daysRemaining) : verificationPending ? t.verificationPending : t.trialExpired}
        </p>
        {!hasAccess && !verificationPending && (
          <a
            href="mailto:contact@cdc.org.ge"
            className="text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 px-4 py-2 rounded-lg no-underline"
          >
            {t.contactUs}
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AiToolCard
          tool="content"
          icon={FileText}
          title={t.contentTitle}
          description={t.contentDesc}
          placeholder={t.contentPlaceholder}
          locked={!hasAccess}
          lang={lang}
        />
        <AiToolCard
          tool="analytics"
          icon={TrendingUp}
          title={t.analyticsTitle}
          description={t.analyticsDesc}
          placeholder={t.analyticsPlaceholder}
          locked={!hasAccess}
          lang={lang}
        />
        <AiToolCard
          tool="assistant"
          icon={MessageCircle}
          title={t.assistantTitle}
          description={t.assistantDesc}
          placeholder={t.assistantPlaceholder}
          locked={!hasAccess}
          lang={lang}
        />
      </div>
    </div>
  );
}
